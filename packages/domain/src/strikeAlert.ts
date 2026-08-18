/**
 * Strike Alert Engine — collision detection between design geometry and
 * subsurface utility volumes + dig-safety layers.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Strike Alert Engine)
 *
 * Two hazard families:
 *   - subsurface utilities (gas, water, sewer, ...) at burial depth —
 *     detectStrikes() (depth-gated).
 *   - dig-safety LAYERS from the Domain Layer Registry (vicmap.easement,
 *     services.gas — any layer flagged triggersDigSafetyAlert) —
 *     detectLayerStrikes() (surface-clearance rule, no depth gate).
 *
 * Both use AABB broad-phase via polyline-to-polyline distance, then 2D
 * segment distance for the narrow phase.
 */

import type { LayerID } from "./layers/layerRegistry";

export type UtilityType = "gas" | "water" | "sewer" | "electric" | "comms" | "reclaimed";

/** A subsurface utility line segment. */
export interface UtilityLine {
  id: string;
  type: UtilityType;
  /** Start point [x, y] in metres. */
  start: [number, number];
  /** End point [x, y] in metres. */
  end: [number, number];
  /** Burial depth in metres (centre of the pipe/cable). */
  depthM: number;
  /** Tolerance radius in metres (pipe radius + safety buffer). */
  toleranceM: number;
}

/** A design element that might collide with utilities. */
export interface DesignExcavation {
  id: string;
  /** Path of the excavation as points in metres (trench, footing, etc.). */
  path: [number, number][];
  /** Excavation depth in metres. */
  depthM: number;
  /** Width of the excavation trench in metres. */
  widthM: number;
}

/** A detected collision. */
export interface StrikeAlert {
  id: string;
  utilityId: string;
  excavationId: string;
  utilityType: UtilityType;
  /** Collision point [x, y, depth] in metres. */
  point: [number, number, number];
  /** Minimum distance between the excavation and utility (0 = direct hit). */
  distanceM: number;
  /** Severity: how deep the overlap goes. */
  severity: "direct" | "near" | "proximity";
}

/**
 * Distance from a point to a line segment in 2D.
 */
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/**
 * Check if two line segments intersect (2D).
 * Returns the intersection point if they do, null otherwise.
 */
function segmentIntersection(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): [number, number] | null {
  const d1x = ax2 - ax1;
  const d1y = ay2 - ay1;
  const d2x = bx2 - bx1;
  const d2y = by2 - by1;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null; // parallel
  const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / denom;
  const s = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / denom;
  if (t < 0 || t > 1 || s < 0 || s > 1) return null;
  return [ax1 + t * d1x, ay1 + t * d1y];
}

/**
 * Minimum distance between two polylines (as point arrays) in 2D.
 * Also checks for segment-segment intersections (returns distance 0 + the
 * crossing point if any segments cross).
 */
function polylineToPolylineDistance(
  a: [number, number][],
  b: [number, number][],
): { distance: number; point: [number, number] } {
  let minDist = Infinity;
  let closestPoint: [number, number] = [0, 0];

  // Check all segment pairs for intersection first (distance 0)
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const isect = segmentIntersection(
        a[i][0], a[i][1], a[i + 1][0], a[i + 1][1],
        b[j][0], b[j][1], b[j + 1][0], b[j + 1][1],
      );
      if (isect) return { distance: 0, point: isect };
    }
  }

  // No intersection — find minimum point-to-segment distance
  for (let i = 0; i < a.length; i++) {
    const segA = a[i];
    const segB = i < a.length - 1 ? a[i + 1] : a[0];
    for (let j = 0; j < b.length; j++) {
      const ptB = b[j];
      const d = pointToSegmentDistance(ptB[0], ptB[1], segA[0], segA[1], segB[0], segB[1]);
      if (d < minDist) {
        minDist = d;
        closestPoint = ptB;
      }
    }
  }

  for (let j = 0; j < b.length; j++) {
    const segA = b[j];
    const segB = j < b.length - 1 ? b[j + 1] : b[0];
    for (let i = 0; i < a.length; i++) {
      const ptA = a[i];
      const d = pointToSegmentDistance(ptA[0], ptA[1], segA[0], segA[1], segB[0], segB[1]);
      if (d < minDist) {
        minDist = d;
        closestPoint = ptA;
      }
    }
  }

  return { distance: minDist, point: closestPoint };
}

/**
 * Check for collisions between design excavations and subsurface utilities.
 *
 * A collision is detected when:
 *   1. The 2D plan distance between the excavation path and the utility line
 *      is within (width/2 + tolerance).
 *   2. The excavation depth reaches or overlaps the utility burial depth.
 *
 * Returns all detected strikes, sorted by distance (direct first).
 */
export function detectStrikes(
  excavations: DesignExcavation[],
  utilities: UtilityLine[],
): StrikeAlert[] {
  const alerts: StrikeAlert[] = [];

  for (const excavation of excavations) {
    for (const utility of utilities) {
      // Broad phase: skip if depths don't overlap
      const excavationReachM = excavation.depthM;
      const utilityTopM = utility.depthM - utility.toleranceM;
      if (excavationReachM < utilityTopM) continue;

      // Narrow phase: 2D plan distance
      const { distance, point } = polylineToPolylineDistance(
        excavation.path,
        [utility.start, utility.end],
      );

      const threshold = excavation.widthM / 2 + utility.toleranceM;
      if (distance > threshold) continue;

      const overlap = threshold - distance;
      const severity: StrikeAlert["severity"] =
        overlap > 0.3 ? "direct" : overlap > 0.1 ? "near" : "proximity";

      alerts.push({
        id: `strike-${excavation.id}-${utility.id}`,
        utilityId: utility.id,
        excavationId: excavation.id,
        utilityType: utility.type,
        point: [point[0], point[1], Math.min(excavation.depthM, utility.depthM)],
        distanceM: distance,
        severity,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sevOrder = { direct: 0, near: 1, proximity: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity] || a.distanceM - b.distanceM;
  });
}

/**
 * A dig-safety hazard segment from a registered layer (an easement ring
 * edge, a service run). Dig hazards are surface-level: any excavation that
 * crosses within `toleranceM` (the dig-clearance rule, 0.9 m) is a strike,
 * regardless of depth.
 */
export interface DigHazardSegment {
  id: string;
  layerId: LayerID;
  /** Start point [x, y] in metres. */
  start: [number, number];
  /** End point [x, y] in metres. */
  end: [number, number];
  /** Safety buffer in metres — the dig-clearance rule (default 0.9). */
  toleranceM: number;
}

/** A strike between an excavation and a dig-safety layer. */
export interface LayerStrikeAlert {
  id: string;
  /** The hazard segment's feature id (e.g. `easement-2-5` — ring+edge). */
  hazardId: string;
  excavationId: string;
  /** The registry layer that owns the hazard (attribution + policy). */
  layerId: LayerID;
  /** Collision point [x, y, depth] in metres. */
  point: [number, number, number];
  distanceM: number;
  severity: "direct" | "near" | "proximity";
}

/**
 * Detect strikes between excavations and dig-safety layers. No depth gate —
 * the dig-safety rule is a plan-distance clearance at any excavation depth.
 * Returns alerts sorted direct-first.
 */
export function detectLayerStrikes(
  excavations: DesignExcavation[],
  hazards: DigHazardSegment[],
): LayerStrikeAlert[] {
  const alerts: LayerStrikeAlert[] = [];

  for (const excavation of excavations) {
    for (const hazard of hazards) {
      const { distance, point } = polylineToPolylineDistance(
        excavation.path,
        [hazard.start, hazard.end],
      );
      const threshold = excavation.widthM / 2 + hazard.toleranceM;
      if (distance > threshold) continue;

      const overlap = threshold - distance;
      const severity: LayerStrikeAlert["severity"] =
        overlap > 0.3 ? "direct" : overlap > 0.1 ? "near" : "proximity";

      alerts.push({
        id: `strike-${excavation.id}-${hazard.id}`,
        hazardId: hazard.id,
        excavationId: excavation.id,
        layerId: hazard.layerId,
        point: [point[0], point[1], excavation.depthM],
        distanceM: distance,
        severity,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sevOrder = { direct: 0, near: 1, proximity: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity] || a.distanceM - b.distanceM;
  });
}

/**
 * Gold Standard 2026 — marquee box-select hit tests (pure, unit-tested).
 *
 * Option A (signed off): the marquee selects placements and features only —
 * photo-trace strokes are a different entity class and the inspector has no
 * editing surface for them, so a marquee can never surface a "selected but
 * uneditable" state. The read-only many-refs summary is the natural result
 * of one drag.
 */

import type {
  CatalogPlacement,
  LandscapeFeature,
} from "@workstream/contracts";
import type { PctPoint } from "./coordTransform";
import type { SelectionRef } from "./selectionPick";

export interface MarqueeBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Minimum drag area (board-% squared) for a drag to count as a marquee. */
export const MIN_MARQUEE_AREA_PCT = 0.25;

export function normalizeBox(a: PctPoint, b: PctPoint): MarqueeBox {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function boxAreaPct(box: MarqueeBox): number {
  return Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
}

export function pointInBox(p: PctPoint, box: MarqueeBox): boolean {
  return p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
}

/**
 * Liang-Barsky clip: the segment intersects the box (including boundary
 * touches) when the parametric entry/exit interval is non-empty. Handles
 * segments that pass exactly through box corners — those read as a hit,
 * not a miss.
 */
function segmentTouchesBox(a: PctPoint, b: PctPoint, box: MarqueeBox): boolean {
  if (pointInBox(a, box) || pointInBox(b, box)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0; // parallel: inside only if within the slab
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, a.x - box.x0)) return false;
  if (!clip(dx, box.x1 - a.x)) return false;
  if (!clip(-dy, a.y - box.y0)) return false;
  if (!clip(dy, box.y1 - a.y)) return false;
  return t0 <= t1;
}

/** Point-in-polygon (ray casting) on a board-% ring. */
function pointInPolygonRing(p: PctPoint, ring: PctPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** A polygon fully containing the box intersects it even when no edge
 *  crosses the box and no vertex lands inside (box dragged inside a bed). */
function boxInsideRing(box: MarqueeBox, ring: PctPoint[]): boolean {
  const corners: PctPoint[] = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ];
  return corners.every((c) => pointInPolygonRing(c, ring));
}

/** A feature is inside the box when any vertex is inside, any edge crosses
 *  it, or (for polygons) the box lies fully inside the feature. */
export function featureInBox(
  feature: LandscapeFeature,
  box: MarqueeBox,
): boolean {
  const pts = feature.geometry.points.map((v) => ({
    x: v.pct.x_pct,
    y: v.pct.y_pct,
  }));
  if (pts.length === 0) return false;
  if (feature.geometry.type === "Point") return pointInBox(pts[0]!, box);
  const closed = feature.geometry.type === "Polygon" && pts.length >= 3;
  if (closed && boxInsideRing(box, pts)) return true;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    if (segmentTouchesBox(pts[i]!, pts[(i + 1) % pts.length]!, box)) return true;
  }
  return false;
}

export function placementsInBox(
  placements: CatalogPlacement[],
  box: MarqueeBox,
): SelectionRef[] {
  return placements
    .filter((p) => pointInBox({ x: p.x_pct, y: p.y_pct }, box))
    .map((p) => ({ kind: "placement", id: p.id }));
}

export function featuresInBox(
  features: LandscapeFeature[],
  box: MarqueeBox,
): SelectionRef[] {
  return features
    .filter((f) => featureInBox(f, box))
    .map((f) => ({ kind: "feature", id: f.id }));
}

/** Option A: placements + features. Photo strokes are out of marquee scope. */
export function marqueeSelectRefs(
  placements: CatalogPlacement[],
  features: LandscapeFeature[],
  box: MarqueeBox,
): SelectionRef[] {
  return [
    ...placementsInBox(placements, box),
    ...featuresInBox(features, box),
  ];
}

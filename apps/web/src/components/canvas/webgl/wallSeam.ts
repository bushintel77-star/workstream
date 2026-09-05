/**
 * Phase 4 seam — elevation-drawn ink → massing geometry.
 *
 * Decision record: docs/PHASE4-SEAM-DECISION-2026.md (v2, D1/D2/A1–A3).
 *
 * A wall drawn as a CLOSED outline on a geometrically-standing canvas is
 * massing geometry waiting to happen: its drawn vertical extent is a metre
 * height, and its outline dropped onto the massing plane is a plan footprint.
 * Three pure facts make that conversion honest rather than clever:
 *
 *   D1  reconciliation is CONTAINMENT of the landed footprint against the
 *       title ring, in the shared board-% horizontal space — crossing ink
 *       lands where drawn with a stamp; it is never moved, never silenced.
 *   D2  standing-ness is GEOMETRIC (live quaternion, not the placement
 *       preset — the hinge gizmo can fold a plane after placement), and the
 *       stroke must be a CLOSED outline: an open stroke drops to a
 *       zero-width line, and inventing a thickness would be fake precision.
 *   D3  the drawn vertical extent is an operator INTENT — stamped
 *       `drawn_height_m` + `height_source: "operator"`, never presented as
 *       measured truth.
 */

import * as THREE from "three";
import type { CanvasStroke, SketchCanvas } from "@workstream/contracts";
import { canvasPctToWorld } from "./canvasPose";
import { worldToPct, type PctPoint } from "./coordTransform";

/** A plane counts as standing while its normal is within this many degrees
 *  of horizontal (the hinge gizmo's snap resolution). */
export const STANDING_EPS_DEG = 1;

/** Board-% distance (first→last point) under which a stroke counts as
 *  closed. Matches the loose closure the Tidy path already accepts. */
const CLOSED_TOLERANCE_PCT = 1.5;

/** Drawn heights below this are degenerate (a tick, not a wall). */
const MIN_DRAWN_HEIGHT_M = 0.05;

/**
 * D2/A2 — standing-ness from the LIVE rotation quaternion, not the
 * placement preset: the hinge gizmo can fold a plane after placement, so
 * the preset is not stable truth. The canvas plane is its local XZ plane
 * (`canvasPctToWorld` maps board-% to local (x, 0, z)), so its normal is
 * local +Y rotated to world. Standing = normal horizontal (plane vertical).
 */
export function isStandingCanvas(canvas: SketchCanvas): boolean {
  const q = new THREE.Quaternion(
    canvas.rotation[0],
    canvas.rotation[1],
    canvas.rotation[2],
    canvas.rotation[3],
  );
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const eps = Math.sin((STANDING_EPS_DEG * Math.PI) / 180);
  return Math.abs(normal.y) <= eps;
}

/** Geometric closure of a stroke in board-% space. */
function strokeIsClosed(stroke: CanvasStroke): boolean {
  const pts = stroke.points;
  if (pts.length < 3) return false;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return (
    Math.hypot(first.x_pct - last.x_pct, first.y_pct - last.y_pct) <=
    CLOSED_TOLERANCE_PCT
  );
}

/** D2 — standing-canvas wall conversion.
 *  Returns the plan footprint (ground board-%) and the drawn vertical
 *  extent in world metres — or null when the stroke is not a wall
 *  candidate (not standing / not closed / degenerate height), which the
 *  commit path skips with its reason counter. */
export function wallFromStandingStroke(
  stroke: CanvasStroke,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): { footprintPct: PctPoint[]; drawnHeightM: number } | null {
  if (!isStandingCanvas(canvas)) return null;
  if (!strokeIsClosed(stroke)) return null;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const footprintPct: PctPoint[] = [];
  for (const p of stroke.points) {
    const world = canvasPctToWorld({ x: p.x_pct, y: p.y_pct }, canvas, scaleM, boardAspect);
    minY = Math.min(minY, world.y);
    maxY = Math.max(maxY, world.y);
    // The footprint is the outline dropped VERTICALLY onto the horizontal
    // board grid — the wall lands where it was drawn, never snapped.
    footprintPct.push(worldToPct(world.x, world.z, scaleM, boardAspect));
  }

  const drawnHeightM = maxY - minY;
  if (drawnHeightM < MIN_DRAWN_HEIGHT_M) return null;
  return { footprintPct, drawnHeightM };
}

/** D1 — reconciliation status of a landed footprint against the title ring. */
export type WallReconciliation =
  | { kind: "contained" }
  | { kind: "crosses"; crossedEdges: number[] }
  | { kind: "indicative" };

/** Points within this many board-% of a boundary edge sit ON the boundary —
 *  shared edges are containment, not crossing. */
const ON_EDGE_TOLERANCE_PCT = 0.25;

function pointInRing(p: PctPoint, ring: PctPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(p: PctPoint, a: PctPoint, b: PctPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** Do segments (p1,p2) and (q1,q2) properly cross (touching edges excluded)? */
function segmentsProperlyCross(
  p1: PctPoint,
  p2: PctPoint,
  q1: PctPoint,
  q2: PctPoint,
): boolean {
  // Any footprint endpoint lying ON the boundary edge is shared/abutting,
  // which D1 treats as containment — exclude it from "crossing".
  if (distToSegment(p1, q1, q2) <= ON_EDGE_TOLERANCE_PCT) return false;
  if (distToSegment(p2, q1, q2) <= ON_EDGE_TOLERANCE_PCT) return false;

  const d = (a: PctPoint, b: PctPoint, p: PctPoint) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

  const d1 = d(q1, q2, p1);
  const d2 = d(q1, q2, p2);
  const d3 = d(p1, p2, q1);
  const d4 = d(p1, p2, q2);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * D1 — the landed footprint is checked for containment in the title ring;
 * crossing edges are named so the conflict warning can point at them. All
 * geometry in board-% (the one horizontal grid every fixed plane shares).
 */
export function reconcileWallFootprint(
  footprintPct: PctPoint[],
  boundaryPct: PctPoint[],
): WallReconciliation {
  if (boundaryPct.length < 3) return { kind: "indicative" };

  const crossedEdges: number[] = [];
  for (let e = 0; e < boundaryPct.length; e++) {
    const q1 = boundaryPct[e]!;
    const q2 = boundaryPct[(e + 1) % boundaryPct.length]!;
    for (let i = 0; i < footprintPct.length; i++) {
      const p1 = footprintPct[i]!;
      const p2 = footprintPct[(i + 1) % footprintPct.length]!;
      if (segmentsProperlyCross(p1, p2, q1, q2)) {
        crossedEdges.push(e);
        break;
      }
    }
  }
  if (crossedEdges.length > 0) return { kind: "crosses", crossedEdges };

  const fullyInside = footprintPct.every(
    (p) =>
      pointInRing(p, boundaryPct) ||
      boundaryPct.some((_, i) => {
        const a = boundaryPct[i]!;
        const b = boundaryPct[(i + 1) % boundaryPct.length]!;
        return distToSegment(p, a, b) <= ON_EDGE_TOLERANCE_PCT;
      }),
  );
  return fullyInside ? { kind: "contained" } : { kind: "crosses", crossedEdges: [] };
}

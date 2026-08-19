/**
 * Gold Standard 2026 — Real-time stroke vectorization (the Trace & Bake
 * vector node network).
 *
 * When a sketch gesture finishes, the raw pointer path is simplified
 * (Douglas-Peucker) and smoothed into cubic Bézier segments (centripetal
 * Catmull-Rom). The result is the stroke's PARAMETRIC ANCHOR: a node network
 * the visual ink stays anchored to, so drawn strokes scale, rotate, and
 * project cleanly into Elevation and Garden 3D modes.
 *
 * Everything here works in board-% space — the same projection-independent
 * space CanvasStroke.points live in — so the anchor transforms with the
 * stroke automatically (no world-space drift on camera or mode changes).
 *
 * Pure functions — safe to run in the background after the gesture ends.
 *
 * RDP TOLERANCE CONTRACT (future-proofing — do not change today's default
 * casually):
 *   `DEFAULT_DP_EPSILON_PCT` is FIXED in board-% space. That is correct for
 *   the 2D plan view. The day a scale-coupled LOD pass is added (per
 *   layerPolicy.ts, that is a deferred non-goal until a scaling wall
 *   appears), ε MUST be derived from the PROJECTED screen-space deviation at
 *   each stroke's position — never a single global altitude value — because
 *   the viewBlend ortho↔perspective lerp foreshortens rear strokes: a
 *   fixed ε over-simplifies geometry at the back of a perspective view.
 */

import type { PctPoint } from "./coordTransform";

/** A cubic Bézier segment (control points in board-% space). */
export interface CubicBezier {
  c0: PctPoint;
  c1: PctPoint;
  c2: PctPoint;
  c3: PctPoint;
}

/** The parametric anchor of a stroke. */
export interface StrokeVector {
  segments: CubicBezier[];
  closed: boolean;
}

/** Default Douglas-Peucker tolerance (board-% units). */
export const DEFAULT_DP_EPSILON_PCT = 0.25;

/**
 * Simplify a polyline with the Douglas-Peucker algorithm (iterative stack
 * implementation — no recursion depth risk on long strokes). `epsilon` is in
 * board-% units. Always keeps the first and last point.
 */
export function simplifyDouglasPeucker(
  points: readonly PctPoint[],
  epsilon: number = DEFAULT_DP_EPSILON_PCT,
): PctPoint[] {
  if (points.length <= 2) return [...points];

  const sqEps = epsilon * epsilon;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const a = points[first]!;
    const b = points[last]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let maxDistSq = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;
      // Perpendicular distance from p to the segment a→b.
      let distSq: number;
      if (lenSq === 0) {
        distSq = (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
      } else {
        const t =
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        const cx = a.x + t * dx;
        const cy = a.y + t * dy;
        distSq = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
      }
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        index = i;
      }
    }

    if (index !== -1 && maxDistSq > sqEps) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: PctPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i] === 1) out.push(points[i]!);
  }
  return out;
}

function dist(a: PctPoint, b: PctPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Convert a polyline into cubic Bézier segments via CENTRIPETAL Catmull-Rom
 * (alpha 0.5 — knot spacing ∝ √distance, which resists cusps and
 * self-intersections on wobbly freehand paths). Each input segment
 * [p[i], p[i+1]] becomes one cubic segment whose endpoints exactly hit the
 * input points — the curve is an interpolation, not an approximation.
 *
 * Open curves duplicate the end points (feathered tangent); closed curves
 * wrap modulo the ring (one segment per vertex).
 */
export function catmullRomToCubic(
  points: readonly PctPoint[],
  closed: boolean,
): CubicBezier[] {
  const n = points.length;
  if (n < 2) return [];
  if (n === 2) {
    const [a, b] = points;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return [{ c0: a, c1: mid, c2: mid, c3: b }];
  }

  const idx = (i: number): PctPoint => {
    if (closed) return points[((i % n) + n) % n]!;
    return points[Math.max(0, Math.min(n - 1, i))]!;
  };

  const segments: CubicBezier[] = [];
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = idx(i - 1);
    const p1 = idx(i);
    const p2 = idx(i + 1);
    const p3 = idx(i + 2);

    // Centripetal knot parameters (alpha = 0.5).
    const t0 = 0;
    const t1 = t0 + Math.sqrt(dist(p0, p1));
    const t2 = t1 + Math.sqrt(dist(p1, p2));
    const t3 = t2 + Math.sqrt(dist(p2, p3));

    const m1x = (p2.x - p0.x) / (t2 - t0 || 1e-9);
    const m1y = (p2.y - p0.y) / (t2 - t0 || 1e-9);
    const m2x = (p3.x - p1.x) / (t3 - t1 || 1e-9);
    const m2y = (p3.y - p1.y) / (t3 - t1 || 1e-9);

    const dt = t2 - t1;
    segments.push({
      c0: p1,
      c1: { x: p1.x + (m1x * dt) / 3, y: p1.y + (m1y * dt) / 3 },
      c2: { x: p2.x - (m2x * dt) / 3, y: p2.y - (m2y * dt) / 3 },
      c3: p2,
    });
  }
  return segments;
}

/**
 * Vectorize a raw pointer path: Douglas-Peucker simplification followed by
 * centripetal Catmull-Rom → cubic Bézier conversion. The returned node
 * network IS the parametric anchor (board-% space).
 */
export function vectorizeStroke(
  points: readonly PctPoint[],
  opts?: { epsilon?: number; closed?: boolean },
): StrokeVector {
  const closed = opts?.closed ?? false;
  const simplified = simplifyDouglasPeucker(
    points,
    opts?.epsilon ?? DEFAULT_DP_EPSILON_PCT,
  );
  return {
    segments: catmullRomToCubic(simplified, closed),
    closed,
  };
}

/**
 * Gold Standard 2026 — Draw-time snap (metre-space port of the SVG snap ladder).
 *
 * The SVG studio's snap engine (handoff/geometry/snap.ts) works in board-% +
 * screen pixels. The WebGL ink layer (FusedSketchLayer) works in world metres
 * with no zoom context, so this module re-expresses the same priority ladder
 * in world metres:
 *
 *   1. close  — magnet to the live stroke's origin (auto-close assist)
 *   2. vertex — magnet to any committed stroke endpoint (cadastral join)
 *   3. angle  — soft-snap the ray from the last live point to 45° increments
 *   4. none   — the raw pointer passes through untouched
 *
 * Pure function: identical inputs → identical output. Safe to call per
 * pointer-move.
 *
 * Binding: docs/GOLD-STANDARD-2026.md (zero-chrome drafting precision)
 */

/** Snap kinds, highest priority first. null = no snap (raw pointer). */
export type SnapKind = "close" | "vertex" | "angle" | null;

/** A snap decision: where the pointer SHOULD read, and why. */
export interface SnapHint {
  x: number;
  z: number;
  kind: SnapKind;
}

/** World point in the XZ plane (metres). */
export interface WorldXZ {
  x: number;
  z: number;
}

/** Close magnet radius — matches FusedSketchLayer's SNAP_CLOSE_M. */
export const SNAP_CLOSE_M = 2.0;
/** Vertex magnet radius — cadastral joins, generous on a lot scale. */
export const SNAP_VERTEX_M = 1.2;
/** Angle soft-snap window either side of a 45° increment. */
export const SNAP_ANGLE_TOL_DEG = 5;
/** Angle increment (degrees). 45 = the drafting octagon. */
export const SNAP_ANGLE_STEP_DEG = 45;

export interface SnapDrawOptions {
  closeM?: number;
  vertexM?: number;
  angleTolDeg?: number;
  angleStepDeg?: number;
}

/**
 * Resolve the effective draw point for a raw pointer position.
 *
 * @param rawX/rawZ  The raw pointer in world metres.
 * @param origin     The live stroke's first point — pass ONLY when the stroke
 *                   is long enough that closing is meaningful (≥3 points).
 * @param last       The last accepted live point (drives the angle snap).
 * @param vertices   Committed stroke endpoints (vertex magnets).
 */
export function snapDrawPointer(
  rawX: number,
  rawZ: number,
  ctx: {
    origin: WorldXZ | null;
    last: WorldXZ | null;
    vertices: readonly WorldXZ[];
  },
  opts?: SnapDrawOptions,
): SnapHint {
  const closeM = opts?.closeM ?? SNAP_CLOSE_M;
  const vertexM = opts?.vertexM ?? SNAP_VERTEX_M;
  const angleTolDeg = opts?.angleTolDeg ?? SNAP_ANGLE_TOL_DEG;
  const angleStepDeg = opts?.angleStepDeg ?? SNAP_ANGLE_STEP_DEG;

  // 1. Close — the strongest magnet (finishing a polygon).
  if (ctx.origin) {
    const d = Math.hypot(rawX - ctx.origin.x, rawZ - ctx.origin.z);
    if (d <= closeM) {
      return { x: ctx.origin.x, z: ctx.origin.z, kind: "close" };
    }
  }

  // 2. Vertex — nearest committed endpoint within radius.
  let bestVertex: WorldXZ | null = null;
  let bestVertexDist = Infinity;
  for (const v of ctx.vertices) {
    const d = Math.hypot(rawX - v.x, rawZ - v.z);
    if (d <= vertexM && d < bestVertexDist) {
      bestVertex = v;
      bestVertexDist = d;
    }
  }
  if (bestVertex) {
    return { x: bestVertex.x, z: bestVertex.z, kind: "vertex" };
  }

  // 3. Angle — project the pointer onto the nearest 45° ray from the last
  //    point, keeping the pointer's current distance (soft: length is free,
  //    direction is quantised).
  if (ctx.last) {
    const dx = rawX - ctx.last.x;
    const dz = rawZ - ctx.last.z;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      const rawDeg = (Math.atan2(dz, dx) * 180) / Math.PI;
      const snappedDeg = Math.round(rawDeg / angleStepDeg) * angleStepDeg;
      // |raw − snapped| ≤ step/2 by construction (22.5° for a 45° step).
      const deltaDeg = Math.abs(rawDeg - snappedDeg);
      if (deltaDeg <= angleTolDeg) {
        const rad = (snappedDeg * Math.PI) / 180;
        return {
          x: ctx.last.x + Math.cos(rad) * len,
          z: ctx.last.z + Math.sin(rad) * len,
          kind: "angle",
        };
      }
    }
  }

  // 4. No snap.
  return { x: rawX, z: rawZ, kind: null };
}

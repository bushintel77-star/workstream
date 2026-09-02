/**
 * Gold Standard 2026 — Draw-time snap (metre-space port of the SVG snap ladder).
 *
 * The SVG studio's snap engine (handoff/geometry/snap.ts) works in board-% +
 * screen pixels. The WebGL ink layer (FusedSketchLayer) works in world metres
 * with no zoom context, so this module re-expresses the same priority ladder
 * in world metres:
 *
 *   1. close    — magnet to the live stroke's origin (auto-close assist)
 *   2. vertex   — magnet to any committed stroke endpoint (cadastral join)
 *   3. boundary — magnet to the nearest point on a title boundary edge
 *   4. grid     — origin-aligned stationing lattice (1 m, shared with the
 *                 ruler) — spec 2.7; beats the free octagon but loses to the
 *                 site points/lines above it
 *   5. angle    — soft-snap the ray from the last live point to 45° increments
 *   6. none     — the raw pointer passes through untouched
 *
 * The boundary rung sits above angle deliberately: on a landscape setout the
 * edges that matter run along or off the title line, so a real site line beats
 * an abstract 45° octagon. It sits below vertex because a specific point is a
 * stronger intent than a line. Snapping to the title line is also what keeps
 * drawn geometry reconciled with the boundary rather than merely near it
 * (AGENTS.md, title-boundary reconciliation rule).
 *
 * Pure function: identical inputs → identical output. Safe to call per
 * pointer-move.
 *
 * Binding: docs/GOLD-STANDARD-2026.md (zero-chrome drafting precision)
 */

import { DEFAULT_STATIONING_STEP_M, snapToStationingGrid } from "./stationing";

/** Snap kinds, highest priority first. null = no snap (raw pointer). */
export type SnapKind = "close" | "vertex" | "boundary" | "grid" | "angle" | null;

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

/** A title boundary edge in world metres (one segment of the parcel ring). */
export interface SnapSegment {
  a: WorldXZ;
  b: WorldXZ;
}

/** Close magnet radius — matches FusedSketchLayer's SNAP_CLOSE_M. */
export const SNAP_CLOSE_M = 2.0;
/** Vertex magnet radius — cadastral joins, generous on a lot scale. */
export const SNAP_VERTEX_M = 1.2;
/**
 * Title boundary magnet radius. Tighter than the vertex magnet because a line
 * is a far larger target than a point — at the vertex radius it would swallow
 * every pointer move near the parcel edge.
 */
export const SNAP_BOUNDARY_M = 1.0;
/** Angle soft-snap window either side of a 45° increment. */
export const SNAP_ANGLE_TOL_DEG = 5;
/** Angle increment (degrees). 45 = the drafting octagon. */
export const SNAP_ANGLE_STEP_DEG = 45;

export interface SnapDrawOptions {
  closeM?: number;
  vertexM?: number;
  boundaryM?: number;
  /** Stationing lattice step (default 1 m, spec 2.7). */
  gridStepM?: number;
  angleTolDeg?: number;
  angleStepDeg?: number;
}

/** Nearest point to (px,pz) on the segment a→b, clamped to the segment. */
export function closestPointOnSegment(
  px: number,
  pz: number,
  a: WorldXZ,
  b: WorldXZ,
): WorldXZ {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  // Degenerate edge (duplicate ring point) — the segment IS the point.
  if (lenSq === 0) return { x: a.x, z: a.z };
  const t = Math.max(
    0,
    Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / lenSq),
  );
  return { x: a.x + t * dx, z: a.z + t * dz };
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
    /** Title boundary edges in world metres. Omit to disable the rung. */
    boundaryEdges?: readonly SnapSegment[];
  },
  opts?: SnapDrawOptions,
): SnapHint {
  const closeM = opts?.closeM ?? SNAP_CLOSE_M;
  const vertexM = opts?.vertexM ?? SNAP_VERTEX_M;
  const boundaryM = opts?.boundaryM ?? SNAP_BOUNDARY_M;
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

  // 3. Boundary — nearest point on any title boundary edge within radius.
  //    Beats the 45° rung: a real site line outranks the abstract octagon.
  let bestEdge: WorldXZ | null = null;
  let bestEdgeDist = Infinity;
  for (const edge of ctx.boundaryEdges ?? []) {
    const p = closestPointOnSegment(rawX, rawZ, edge.a, edge.b);
    const d = Math.hypot(rawX - p.x, rawZ - p.z);
    if (d <= boundaryM && d < bestEdgeDist) {
      bestEdge = p;
      bestEdgeDist = d;
    }
  }
  if (bestEdge) {
    return { x: bestEdge.x, z: bestEdge.z, kind: "boundary" };
  }

  // 4. Grid — the origin-aligned stationing lattice (shared with the ruler,
  //    spec 2.7). Only magnetises within a quarter-step so free drawing is
  //    not swallowed by the grid everywhere.
  const gridStep = opts?.gridStepM ?? DEFAULT_STATIONING_STEP_M;
  const grid = snapToStationingGrid(rawX, rawZ, gridStep);
  const gridTol = gridStep / 4;
  if (
    Math.abs(grid.x - rawX) <= gridTol &&
    Math.abs(grid.z - rawZ) <= gridTol
  ) {
    return { x: grid.x, z: grid.z, kind: "grid" };
  }

  // 5. Angle — project the pointer onto the nearest 45° ray from the last
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

  // 6. No snap.
  return { x: rawX, z: rawZ, kind: null };
}

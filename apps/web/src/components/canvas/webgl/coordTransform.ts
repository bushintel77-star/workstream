/**
 * Gold Standard 2026 — coordinate transform utilities.
 *
 * Converts board-% space (0–100, the legacy SVG viewBox) to Three.js world
 * space (metres, origin at the (0,0,0) survey peg).
 *
 * This is the bridge between the existing geometry/polygon.ts pure maths
 * (which work in % space) and the R3F scene graph (which works in metres).
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.2
 */

export type PctPoint = { x: number; y: number };

/**
 * Convert a board-% point to metre-space world [x, z] coordinates.
 * The lot spans `scaleM` metres across the board width (X axis).
 * The Y axis is divided by boardAspect to account for the non-uniform
 * stretch that preserveAspectRatio="none" used to handle.
 *
 * Origin is centred on the lot centre (the survey peg sits at the lot's
 * primary corner, but for scene-graph simplicity we centre the lot on
 * the world origin).
 */
export function pctToWorld(
  pct: PctPoint,
  scaleM: number,
  boardAspect: number,
): [number, number] {
  const lotWidthM = scaleM;
  const lotHeightM = scaleM * boardAspect;
  const xM = (pct.x / 100) * lotWidthM - lotWidthM / 2;
  const zM = (pct.y / 100) * lotHeightM - lotHeightM / 2;
  return [xM, zM];
}

/**
 * Convert a metre-space world [x, z] point back to board-% space.
 * Inverse of pctToWorld — used for raycasting pointer → board coordinates.
 */
export function worldToPct(
  xM: number,
  zM: number,
  scaleM: number,
  boardAspect: number,
): PctPoint {
  const lotWidthM = scaleM;
  const lotHeightM = scaleM * boardAspect;
  return {
    x: ((xM + lotWidthM / 2) / lotWidthM) * 100,
    y: ((zM + lotHeightM / 2) / lotHeightM) * 100,
  };
}

/**
 * Convert a board-% ring to metre-space planar coordinates.
 * This mirrors geometry/polygon.ts pctRingToPlanarM but returns centred
 * world coords (origin at lot centre) instead of top-left-anchored.
 */
export function pctRingToWorld(
  pts: PctPoint[],
  scaleM: number,
  boardAspect: number,
): [number, number][] {
  return pts.map((p) => pctToWorld(p, scaleM, boardAspect));
}

/**
 * Convert a board-% distance to metres (for a single axis or diagonal).
 * Mirrors geometry/polygon.ts pctToMetres.
 */
export function pctDeltaToMetres(
  dxPct: number,
  dyPct: number,
  scaleM: number,
  boardAspect = 1,
): number {
  const mx = (dxPct / 100) * scaleM;
  const my = (dyPct / 100) * (scaleM / boardAspect);
  return Math.hypot(mx, my);
}

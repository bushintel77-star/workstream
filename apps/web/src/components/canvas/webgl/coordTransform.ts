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
 * A world-space elevation sample for the terrain heightmap.
 *   - x, z: horizontal world position (metres, lot-centred)
 *   - y:    elevation (metres; AHD/local RL from site_frame.levels.z_m)
 *
 * Single source of truth shared by TerrainMesh, the stroke drape, and the
 * elevation slice — so all three consumers sample identical terrain.
 */
export interface HeightmapPoint {
  x: number;
  z: number;
  y: number;
}

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

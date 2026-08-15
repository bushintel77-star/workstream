/**
 * Gold Standard 2026 — Spatial Layer Contract.
 *
 * The in-canvas geometry layers declare their render policy here instead of
 * ad-hoc depth offsets per component. Law (ARCHITECTURE doc §2.4):
 *
 *   terrain   — the single ground surface (TerrainMesh XOR flat GroundPlane;
 *               never both — two surfaces at the same depth fight)
 *   draped    — geometry that FOLLOWS the terrain (ink, flow, aerial): sits
 *               at surface + offset, depth-tested, renderOrder 1
 *   semantic  — title/council truth (boundary, easements, services): draped
 *               on the surface with a larger clearance, renderOrder 2
 *   markers   — survey furniture (origin peg, TPZ rings): renderOrder 3
 *
 * Lines never fight the depth buffer by being at a constant world-Z: they
 * sample the same terrain field (terrainMath.createElevationSampler) as the
 * mesh, so they are on the surface by construction.
 */

export const SPATIAL_LAYER = {
  terrain: { renderOrder: 0 },
  draped: { renderOrder: 1, /** Surface clearance for depth-tested overlays (m). */ offsetM: 0.02 },
  semantic: { renderOrder: 2, /** Larger clearance — must survive grazing angles. */ offsetM: 0.06 },
  markers: { renderOrder: 3, offsetM: 0.08 },
} as const;

export type SpatialLayerName = keyof typeof SPATIAL_LAYER;

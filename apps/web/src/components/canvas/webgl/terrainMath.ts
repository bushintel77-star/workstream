/**
 * Gold Standard 2026 — Terrain Math (shared IDW elevation).
 *
 * The single source of truth for terrain elevation across the WebGL studio.
 * Three consumers sample IDENTICAL math from this module:
 *   - TerrainMesh        — displaces the ground plane into a heightmap
 *   - FusedSketchLayer   — drapes ink strokes over the terrain (Vertical Truth)
 *   - ElevationSliceLine — draws the section-cut line + profile along the surface
 *
 * If any one of these diverges on a constant or the IDW formula, the ink won't
 * sit on the surface or the slice won't match the mesh. Keeping the math here
 * makes that divergence impossible — they all call the same functions.
 *
 * Coordinate convention: metre-space world (x, z) → elevation (y).
 *   - x: east-west (lot-centred)
 *   - z: north-south (lot-centred)
 *   - y: elevation (metres; AHD/local RL from site_frame.levels.z_m)
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (terrain heightmap + Vertical Truth)
 */

import type { HeightmapPoint } from "./coordTransform";

// Re-export so terrain consumers can import the data type from the terrain
// module without reaching into coordTransform.
export type { HeightmapPoint };

/** Grid resolution — vertices per axis across the lot extent (TerrainMesh). */
export const GRID_SEGMENTS = 60;
/** Vertical exaggeration — makes subtle grade changes (0.5–2m) visible. */
export const VERTICAL_SCALE = 3.0;
/** IDW power parameter — how sharply influence falls off with distance. */
export const IDW_POWER = 2.5;
/** IDW search radius factor (relative to lot scale). */
export const SEARCH_RADIUS_FACTOR = 0.6;

/**
 * IDW interpolation — estimate the elevation at a query point from nearby
 * sample points. Returns 0 (flat) when no samples are within range.
 *
 * Pure function: identical inputs → identical output. Safe to call per-vertex
 * in a hot loop.
 */
export function idwElevation(
  queryX: number,
  queryZ: number,
  samples: HeightmapPoint[],
  searchRadius: number,
): number {
  if (samples.length === 0) return 0;

  let weightSum = 0;
  let elevSum = 0;
  let foundAny = false;

  for (const s of samples) {
    const dx = s.x - queryX;
    const dz = s.z - queryZ;
    const dist = Math.hypot(dx, dz);
    if (dist > searchRadius) continue;
    foundAny = true;
    if (dist === 0) return s.y; // exact sample point
    const w = 1 / Math.pow(dist, IDW_POWER);
    weightSum += w;
    elevSum += w * s.y;
  }

  if (!foundAny || weightSum === 0) return 0;
  return elevSum / weightSum;
}

/**
 * Normalize spot levels to a local datum — subtract the mean elevation so the
 * terrain is centred on y=0. This prevents the whole mesh from floating at
 * AHD ~50m+ (Melbourne elevations) while preserving relative relief.
 *
 * Pure function.
 */
export function normalizeLevels(samples: HeightmapPoint[]): HeightmapPoint[] {
  if (samples.length === 0) return [];
  const meanY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
  return samples.map((s) => ({ ...s, y: (s.y - meanY) * VERTICAL_SCALE }));
}

/**
 * Build a reusable elevation sampler from raw heightmap points.
 *
 * Normalises once (mean-datum + vertical exaggeration) and computes the search
 * radius once, then exposes a closure `(worldX, worldZ) => elevation`. This is
 * the function the drape and slice call per-vertex/per-sample.
 *
 * The sampler MUST be created from the SAME heightmapPoints + scale params that
 * TerrainMesh receives — otherwise the drape/slice won't match the mesh.
 *
 * @returns A sampler function, or null if there are no samples (flat project).
 */
export function createElevationSampler(
  heightmapPoints: HeightmapPoint[],
  scaleM: number,
  boardAspect: number,
): ((worldX: number, worldZ: number) => number) | null {
  if (heightmapPoints.length === 0) return null;
  const normalized = normalizeLevels(heightmapPoints);
  const searchRadius =
    Math.max(scaleM, scaleM * boardAspect) * SEARCH_RADIUS_FACTOR;
  return (worldX: number, worldZ: number) =>
    idwElevation(worldX, worldZ, normalized, searchRadius);
}

/**
 * Drape a %-space ring onto the terrain surface as world-space 3D line
 * points. Each edge is subdivided to <= segmentM so the line follows relief
 * between vertices instead of chording through hills, and every point sits
 * at terrain height + offsetM (the spatial-layer clearance — semantic lines
 * use a larger clearance than draped ink). Without a sampler (flat project)
 * the ring renders at the flat offset, preserving the old behaviour.
 */
export function drapeRingToSurface(
  points: Array<{ x: number; y: number }>,
  opts: {
    sampler: ((worldX: number, worldZ: number) => number) | null;
    scaleM: number;
    boardAspect: number;
    offsetM: number;
    segmentM?: number;
  },
): Array<[number, number, number]> {
  const { sampler, scaleM, boardAspect, offsetM, segmentM = 4 } = opts;
  const toWorld = (p: { x: number; y: number }): [number, number] => [
    (p.x / 100 - 0.5) * scaleM,
    (p.y / 100 - 0.5) * scaleM * boardAspect,
  ];
  const heightAt = (wx: number, wz: number) =>
    (sampler ? sampler(wx, wz) : 0) + offsetM;

  const out: Array<[number, number, number]> = [];
  if (points.length < 2) return out;
  for (let i = 0; i < points.length - 1; i++) {
    const a = toWorld(points[i]);
    const b = toWorld(points[i + 1]);
    const lenM = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(lenM / segmentM));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const wx = a[0] + (b[0] - a[0]) * t;
      const wz = a[1] + (b[1] - a[1]) * t;
      out.push([wx, heightAt(wx, wz), wz]);
    }
  }
  // Terminus (closed or open rings alike).
  const last = toWorld(points[points.length - 1]);
  out.push([last[0], heightAt(last[0], last[1]), last[1]]);
  return out;
}

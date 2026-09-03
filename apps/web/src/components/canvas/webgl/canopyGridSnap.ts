/**
 * Phase M.8 — Canopy grid snap (3m) and option-scatter drop (×5).
 *
 * Spec §7.2: "snap options `canopy grid 3m`, `⌥ drop · scatter ×5`".
 *
 * - Canopy grid snap: when placing a canopy tree, snap to a 3m grid instead
 *   of the default 0.5m drafting grid. This gives regular spacing for
 *   avenue/planting patterns.
 * - Option-scatter drop: holding ⌥ (Alt) on drop scatters 5 placements
 *   around the target point within a radius proportional to the mature
 *   spread, using a deterministic seeded shuffle so the scatter is
 *   reproducible (same seed → same positions).
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.8.
 * Reference: design_handoff §7.2, BUILD_CHECKLIST 8.8.
 */

import type { PctPoint } from "./coordTransform";
import { snapToGridMetres } from "../handoff/geometry/snap";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { matureCanopyRadiusM } from "./fillAreaAssets";

/** Canopy grid spacing in metres (spec: 3m). */
export const CANOPY_GRID_M = 3;

/** Number of scatter placements on ⌥ drop (spec: ×5). */
export const SCATTER_COUNT = 5;

/** Default scatter radius factor relative to mature spread. */
export const SCATTER_RADIUS_FACTOR = 1.5;

/** Deterministic PRNG (mulberry32) so scatter is reproducible per seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Is this symbol a canopy tree (eligible for canopy grid snap)? */
export function isCanopySymbol(symbolId: string): boolean {
  const type = mapSymbolToStudioType(symbolId);
  return type === "canopy" || type === "feature" || type === "exist";
}

/**
 * Snap a point to the canopy grid (3m) if the symbol is a canopy tree,
 * otherwise snap to the default drafting grid (0.5m).
 */
export function snapForSymbol(
  raw: PctPoint,
  scaleM: number,
  symbolId: string,
): PctPoint {
  if (isCanopySymbol(symbolId)) {
    return snapToGridMetres(raw, scaleM, CANOPY_GRID_M);
  }
  return snapToGridMetres(raw, scaleM);
}

/**
 * Generate scatter positions around a centre point for ⌥ drop.
 *
 * Uses a deterministic PRNG seeded by the centre coordinates + symbol id,
 * so the same drop produces the same scatter (reproducibility for undo).
 *
 * @param centre   The snapped centre point (board %).
 * @param scaleM   Board scale in metres.
 * @param boardAspect  Board aspect ratio.
 * @param symbolId The symbol being scattered.
 * @param seed     Optional explicit seed (for testing).
 * @returns        5 points including the centre, scattered within
 *                 SCATTER_RADIUS_FACTOR × mature spread.
 */
export function scatterDropPoints(
  centre: PctPoint,
  scaleM: number,
  boardAspect: number,
  symbolId: string,
  seed?: number,
): PctPoint[] {
  const radiusM = matureCanopyRadiusM(symbolId) ?? 1.5;
  const scatterRadiusM = radiusM * SCATTER_RADIUS_FACTOR;

  // Convert scatter radius from metres to board %
  const radiusXPct = (scatterRadiusM / scaleM) * 100;
  const radiusYPct = (scatterRadiusM / (scaleM * boardAspect)) * 100;

  // Deterministic seed from centre + symbol
  const seedValue =
    seed ??
    Math.floor(centre.x * 1000) + Math.floor(centre.y * 1000) * 31 + hashString(symbolId);

  const rng = mulberry32(seedValue);
  const points: PctPoint[] = [{ ...centre }];

  for (let i = 1; i < SCATTER_COUNT; i++) {
    // Uniform scatter within a disc
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 1.0; // sqrt for uniform area distribution
    points.push({
      x: centre.x + Math.cos(angle) * r * radiusXPct,
      y: centre.y + Math.sin(angle) * r * radiusYPct,
    });
  }

  return points;
}

/** Simple string hash for seeding. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Should this drop scatter? (⌥ / Alt held)
 */
export function shouldScatter(altKey: boolean): boolean {
  return altKey;
}

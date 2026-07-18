import type { BrushRecipe, CatalogPlacement, CatalogSymbol } from "@workstream/contracts";

const SWATCH_MAX = 5;

export function recipeFromPlacement(
  placement: CatalogPlacement,
  symbol?: CatalogSymbol | null,
  idFactory: () => string = () => crypto.randomUUID(),
): BrushRecipe {
  return {
    id: idFactory(),
    symbol_id: placement.symbol_id,
    scale: placement.scale,
    rotation_deg: placement.rotation_deg,
    label: placement.label ?? symbol?.label,
    copy_geometry: true,
    copy_material: true,
    copy_pricing: true,
  };
}

/** Push recipe to front of MRU history (max 5). Dedupe by symbol+scale+rotation. */
export function pushSwatchHistory(
  history: BrushRecipe[],
  recipe: BrushRecipe,
  max = SWATCH_MAX,
): BrushRecipe[] {
  const key = (r: BrushRecipe) =>
    `${r.symbol_id}:${r.scale.toFixed(2)}:${Math.round(r.rotation_deg)}`;
  const next = [recipe, ...history.filter((r) => key(r) !== key(recipe))];
  return next.slice(0, max);
}

export function jitterPlacement(
  base: { scale: number; rotation_deg: number },
  rng: () => number = Math.random,
): { scale: number; rotation_deg: number } {
  const scaleJitter = 1 + (rng() * 2 - 1) * 0.08;
  const rotJitter = (rng() * 2 - 1) * 15;
  return {
    scale: Math.min(4, Math.max(0.35, base.scale * scaleJitter)),
    rotation_deg: (base.rotation_deg + rotJitter + 360) % 360,
  };
}

/** Deterministic PRNG from seed (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

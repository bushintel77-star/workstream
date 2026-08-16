/**
 * Growth Studio — data layer.
 *
 * Bridges the real design canvas (placements + catalog) into the 3D growth
 * simulation. No fabricated geometry: every plant instance here comes from an
 * actual `CatalogPlacement` resolved against the real Curtis & Co catalog
 * (`CURTIS_CATALOG_SYMBOLS` — the full served catalog: size ladder, design
 * library, and every symbol pack), and every conflict comes from the same
 * `buildGrowthTemporalRings` math the 2D board findings use — this view is a
 * different lens on the same domain logic, not a separate simulation.
 */

import {
  CURTIS_CATALOG_SYMBOLS,
  buildGrowthTemporalRings,
  type GrowthStageId,
  type GrowthTemporalRing,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol } from "@workstream/contracts";

export type { GrowthStageId, GrowthTemporalRing };

/** Coarse ring-math bucket — only gates `buildGrowthTemporalRings`, never shown. */
type RingBucket = "canopy" | "hedge" | "bed" | "feature";

export type GrowthPlantInstance = {
  id: string;
  xPct: number;
  yPct: number;
  label: string;
  botanicalName: string | null;
  matureHeightM: number;
  matureSpreadM: number;
  /** Vicmap-sourced existing tree — excluded from growth-stage animation. */
  existing: boolean;
  ringBucket: RingBucket;
};

const SYMBOL_BY_ID = new Map<string, CatalogSymbol>(
  CURTIS_CATALOG_SYMBOLS.map((s) => [s.id, s]),
);

function classifyRingBucket(symbol: CatalogSymbol): RingBucket {
  const kw = symbol.keywords ?? [];
  if (kw.includes("hedge") || kw.includes("screen")) return "hedge";
  if (kw.includes("grass") || kw.includes("understorey") || kw.includes("mass"))
    return "bed";
  if ((symbol.mature_height_m ?? 0) >= 2) return "canopy";
  return "feature";
}

/** Fallback board width (m) when the site frame has no calibrated scale yet. */
export const DEFAULT_BOARD_WIDTH_M = 20;

/**
 * Resolve real planting placements → plant instances for the 3D scene.
 * Skips anything that isn't a catalogued planting symbol with a known
 * mature size — no invented species, no invented dimensions.
 */
export function buildGrowthPlantInstances(
  placements: readonly CatalogPlacement[] | null | undefined,
): GrowthPlantInstance[] {
  if (!placements?.length) return [];
  const out: GrowthPlantInstance[] = [];
  for (const p of placements) {
    const symbol = SYMBOL_BY_ID.get(p.symbol_id);
    if (!symbol || symbol.category !== "planting") continue;
    const matureHeightM = symbol.mature_height_m;
    const matureSpreadM = symbol.default_width_m ?? symbol.mature_height_m;
    if (!matureHeightM || !matureSpreadM) continue;
    out.push({
      id: p.id,
      xPct: p.x_pct,
      yPct: p.y_pct,
      label: symbol.label,
      botanicalName: symbol.botanical_name ?? null,
      matureHeightM,
      matureSpreadM,
      existing: p.source === "vicmap_tree",
      ringBucket: classifyRingBucket(symbol),
    });
  }
  return out;
}

/**
 * Real crowding / root-conflict findings at the scrubbed growth stage —
 * a direct call into the same domain function the 2D board uses.
 */
export function buildGrowthConflicts(
  instances: readonly GrowthPlantInstance[],
  growth: GrowthStageId,
  boardWidthM: number | null | undefined,
): GrowthTemporalRing[] {
  const scaleM =
    boardWidthM != null && boardWidthM > 0 ? boardWidthM : DEFAULT_BOARD_WIDTH_M;
  return buildGrowthTemporalRings({
    items: instances.map((it) => ({
      id: it.id,
      type: it.ringBucket,
      x: it.xPct,
      y: it.yPct,
      mature_spread_m: it.matureSpreadM,
      existing: it.existing,
    })),
    growth,
    scaleM,
  });
}

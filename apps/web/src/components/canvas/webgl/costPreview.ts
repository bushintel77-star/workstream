/**
 * Gold Standard 2026 — Cost Preview (live placement cost estimate).
 *
 * Pure: symbol_id + count → estimated AUD impact. Shows in the dock's
 * armed-mode pill and during area/row mass-plant drag.
 *
 * Rates are pre-computed per studio type from DEFAULT_META in
 * studio-preemptive-estimate.ts, with typical secondary material + labour
 * allowances baked in so the preview is honest (not just the surface rate).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (asset dock cost preview)
 */

import { getCatalogSymbol } from "@workstream/domain";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";

/**
 * Per-type all-in cost estimate (AUD, ex-GST) for one unit of that studio type.
 * Includes primary material + typical secondary materials + labour.
 * Derived from DEFAULT_META rates in studio-preemptive-estimate.ts:
 *   paving:  surface 320 + excav 85 + base 65 + sand 90 + joint 2.4 + edge 28 + labour 85×0.35 + light 85 = ~675
 *   deck:    surface 480 + frame 95 + labour 85×0.35 + light 120 = ~705
 *   lawn:    45/m² + labour 75×0.15 + drip 14 + emit 1.85 = ~62/m²
 *   bed:     180/m² + labour 75×0.15 + drip 14 + emit 1.85 = ~207/m²
 *   hedge:   260/lm + labour 75 + drip 14 = ~349/lm
 *   canopy:  650 + labour 45 + uplight 180 = ~875
 *   feature: 1200 + labour 45 + uplight 180 = ~1425
 *   frenchdrain: 220/lm + pipe 18 + gravel 95×0.12 = ~249/lm
 *   exist:   0
 */

const ALL_IN_COST_PER_UNIT: Record<string, number> = {
  canopy: 875,
  feature: 1425,
  hedge: 349,
  bed: 207,
  lawn: 62,
  paving: 675,
  deck: 705,
  frenchdrain: 249,
  exist: 0,
};

/**
 * Estimated cost (AUD, ex-GST) for placing one unit of this symbol.
 * Returns 0 for unknown (non-catalog) or existing symbols. The catalog guard
 * is required: `mapSymbolToStudioType` falls back to "canopy" for ids the
 * catalog does not know, which would otherwise mint a phantom tree cost.
 */
export function estimatedCostPerUnit(symbolId: string): number {
  if (!getCatalogSymbol(symbolId)) return 0;
  const type = mapSymbolToStudioType(symbolId);
  return ALL_IN_COST_PER_UNIT[type] ?? 0;
}

/**
 * Estimated total cost for a given count of placements.
 * For area plant: count = number of stems placed.
 * For single placement: count = 1.
 */
export function estimatedCostTotal(
  symbolId: string,
  count: number,
): number {
  return Math.round(estimatedCostPerUnit(symbolId) * count);
}

/**
 * Format a dollar amount for the UI preview chip.
 * < $1,000 → "$XXX"
 * ≥ $1,000 → "$X.Xk"
 */
export function formatCostPreview(amount: number): string {
  if (amount <= 0) return "";
  if (amount < 1_000) return `$${Math.round(amount)}`;
  return `$${(amount / 1_000).toFixed(1)}k`;
}

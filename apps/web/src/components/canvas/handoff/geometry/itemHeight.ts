import {
  gardenFamilyForSymbol,
  getCatalogSymbol,
  symbolMatureHeightM,
  symbolSpreadM,
  type GardenAssetFamily,
} from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../studioCatalog";

/**
 * One resolver for "how tall is this placement".
 *
 * Precedence: the item's hydrated height → the placed catalog symbol's mature
 * height → the coarse studio type. Every elevation surface (elevation board,
 * fit sheet, tilt billboard, plan callout) reads through here so a placed
 * 7.8 m tree cannot draw at one height on the board and another on the sheet.
 *
 * Pure — no React, no DOM.
 */

function safeScale(it: StudioItem): number {
  return it.scale > 0 ? it.scale : 1;
}

/** Catalogued mature height (m) before placement scale. 0 = no presence. */
export function resolveItemMatureHeightM(it: StudioItem): number {
  if (it.heightM != null && it.heightM > 0) return it.heightM;
  const fromSymbol = symbolMatureHeightM(it.symbolId);
  if (fromSymbol != null) return fromSymbol;
  return BY_TYPE[it.t]?.heightM ?? 0;
}

/** Drawn height (m) — mature height with placement scale applied. */
export function resolveItemHeightM(it: StudioItem): number {
  return resolveItemMatureHeightM(it) * safeScale(it);
}

/**
 * Drawn height (m) including the growth stage. Existing trees are already
 * mature, so growth never scales them.
 */
export function resolveItemHeightGrownM(
  it: StudioItem,
  growthFactor: number,
): number {
  const gk = BY_TYPE[it.t]?.existing ? 1 : growthFactor;
  return resolveItemHeightM(it) * gk;
}

/** True when the placement should appear as a profile in the elevation. */
export function hasElevationPresence(it: StudioItem): boolean {
  return resolveItemMatureHeightM(it) > 0;
}

/** Mature spread / platform width (m), null when nothing knows it. */
export function resolveItemSpreadM(it: StudioItem): number | null {
  const fromSymbol = symbolSpreadM(it.symbolId);
  if (fromSymbol != null) return fromSymbol;
  return BY_TYPE[it.t]?.canopyM ?? null;
}

/**
 * Drawn spread (m) with placement scale and growth stage applied — the width
 * companion to `resolveItemHeightGrownM`. Existing trees are already mature, so
 * growth never widens them. Null when nothing knows the spread.
 */
export function resolveItemSpreadGrownM(
  it: StudioItem,
  growthFactor: number,
): number | null {
  const mature = resolveItemSpreadM(it);
  if (mature == null) return null;
  const gk = BY_TYPE[it.t]?.existing ? 1 : growthFactor;
  return mature * safeScale(it) * gk;
}

/** Silhouette family, null for structures / fixtures (plain profile). */
export function resolveItemFamily(it: StudioItem): GardenAssetFamily | null {
  const fromSymbol = gardenFamilyForSymbol(it.symbolId);
  if (fromSymbol) return fromSymbol;
  switch (it.t) {
    case "canopy":
    case "feature":
    case "exist":
      return "tree";
    case "hedge":
      return "hedge";
    case "deck":
      return "deck";
    case "bed":
      return "shrub";
    default:
      return null;
  }
}

/**
 * Name for the elevation callout — the placed symbol's label when we have one
 * (so the drawing says "Pleached hornbeam", not "Hedge"), else the type tag.
 */
export function elevationTagFor(it: StudioItem): string {
  const label = it.symbolId ? getCatalogSymbol(it.symbolId)?.label : undefined;
  return label?.trim() || BY_TYPE[it.t]?.tag || it.t;
}

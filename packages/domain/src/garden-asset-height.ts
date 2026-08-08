import { getCatalogSymbol } from "./catalog";
import {
  gardenSizeStep,
  type GardenAssetFamily,
} from "./garden-size-ladder";

/**
 * Height + silhouette family for a placed catalog symbol.
 *
 * `CatalogPlacement` stores no height, so every elevation surface resolves the
 * number from the placed `symbol_id`. One symbol always means one mature
 * height — that is what makes the plan and the elevation agree after a reload.
 *
 * Domain-pure: no DOM, no server imports.
 */

/** Mature height (m) for a symbol, or null when it has no vertical presence. */
export function symbolMatureHeightM(symbolId: string | null | undefined): number | null {
  if (!symbolId) return null;
  const key = symbolId.trim().toLowerCase();
  if (!key) return null;
  const rung = gardenSizeStep(key);
  if (rung) return rung.heightM;
  const symbol = getCatalogSymbol(key);
  const h = symbol?.mature_height_m;
  return typeof h === "number" && h > 0 ? h : null;
}

/** Mature spread / platform width (m) for a symbol, or null when unknown. */
export function symbolSpreadM(symbolId: string | null | undefined): number | null {
  if (!symbolId) return null;
  const key = symbolId.trim().toLowerCase();
  if (!key) return null;
  const rung = gardenSizeStep(key);
  if (rung) return rung.spreadM;
  const w = getCatalogSymbol(key)?.default_width_m;
  return typeof w === "number" && w > 0 ? w : null;
}

/**
 * Symbols whose family a keyword sweep would get wrong. Structures (walls,
 * gates, batten screens, pergolas) are deliberately absent — they are not
 * garden planting and draw as a plain profile, not a canopy or a hedge block.
 */
const FAMILY_OVERRIDES: Record<string, GardenAssetFamily> = {
  // Elevated foliage panel on clear stems
  "hornbeam-pleached": "screen",
  "bamboo-screen": "screen",
  // Trunked forms
  "olive-standard": "tree",
  "citrus-standard": "tree",
  "magnolia-little-gem": "tree",
  "pyrus-capital": "tree",
  "tree-fern": "tree",
  "existing-tree-retain": "tree",
  // Massed / mounded forms
  "box-ball": "shrub",
  "cycas-revoluta": "shrub",
  "birdsnest-fern": "shrub",
  "boston-ivy": "shrub",
  "kangaroo-paw": "shrub",
  // Clipped green wall
  "hedge-clip-formal": "hedge",
  // Hardscape platform
  "timber-deck": "deck",
};

const DECK_RE = /deck/;
const SCREEN_RE = /pleach|bamboo/;
const HEDGE_RE = /hedge|clipped|formal-clip/;
const TREE_RE = /(^|[^a-z])tree|canopy|standard|magnolia|pyrus|olive|citrus/;
const SHRUB_RE =
  /shrub|ball|sphere|topiary|clump|drift|grass|fern|ground|carpet|mass|bed|ivy|lavender|salvia|rosemary|paw|edge|plant/;

/**
 * Silhouette family for a placed symbol, or null when the symbol is not garden
 * planting / decking (structures, flat surfaces, fixtures, annotations).
 */
export function gardenFamilyForSymbol(
  symbolId: string | null | undefined,
): GardenAssetFamily | null {
  if (!symbolId) return null;
  const key = symbolId.trim().toLowerCase();
  if (!key) return null;

  const rung = gardenSizeStep(key);
  if (rung) return rung.family;

  const override = FAMILY_OVERRIDES[key];
  if (override) return override;

  const symbol = getCatalogSymbol(key);
  // Only planting and paving carry a garden silhouette.
  if (symbol && symbol.category !== "planting" && symbol.category !== "paving") {
    return null;
  }
  const hay = [key, symbol?.label ?? "", ...(symbol?.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  if (DECK_RE.test(hay)) return "deck";
  if (SCREEN_RE.test(hay)) return "screen";
  if (HEDGE_RE.test(hay)) return "hedge";
  if (TREE_RE.test(hay)) return "tree";
  if (SHRUB_RE.test(hay)) return "shrub";
  return null;
}

/** True when a placed symbol should appear as a profile in the elevation. */
export function hasElevationPresence(
  symbolId: string | null | undefined,
): boolean {
  return (symbolMatureHeightM(symbolId) ?? 0) > 0;
}

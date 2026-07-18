import type { CatalogSymbol } from "@workstream/contracts";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";
import { OPEN_CROP_SYMBOLS } from "./open-crop-symbols";
import { OSMIC_LANDSCAPE_SYMBOLS } from "./osmic-landscape-symbols";
import { PLANZV_DESIGN_SYMBOLS } from "./planzv-design-symbols";
import { WIKIMEDIA_TREE_SYMBOLS } from "./wikimedia-tree-symbols";

/**
 * Curtis library + PlanZV (CC0 AI CAD) + Osmic (CC0) + Wikimedia trees + Open Crop.
 * Design / AI CAD packs are listed before edible crops so palette + AI see them first.
 */
export const CURTIS_CATALOG_SYMBOLS: CatalogSymbol[] = [
  ...CURTIS_DESIGN_ASSETS,
  ...PLANZV_DESIGN_SYMBOLS,
  ...OSMIC_LANDSCAPE_SYMBOLS,
  ...WIKIMEDIA_TREE_SYMBOLS,
  ...OPEN_CROP_SYMBOLS,
];

export function getCatalogSymbol(id: string): CatalogSymbol | undefined {
  return CURTIS_CATALOG_SYMBOLS.find((s) => s.id === id);
}

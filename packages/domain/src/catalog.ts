import type { CatalogSymbol } from "@workstream/contracts";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";
import { OPEN_CROP_SYMBOLS } from "./open-crop-symbols";
import { OSMIC_LANDSCAPE_SYMBOLS } from "./osmic-landscape-symbols";
import { WIKIMEDIA_TREE_SYMBOLS } from "./wikimedia-tree-symbols";

/** Curtis library + Osmic (CC0) + Wikimedia trees (CC BY-SA) + Open Crop (CC0). */
export const CURTIS_CATALOG_SYMBOLS: CatalogSymbol[] = [
  ...CURTIS_DESIGN_ASSETS,
  ...OSMIC_LANDSCAPE_SYMBOLS,
  ...WIKIMEDIA_TREE_SYMBOLS,
  ...OPEN_CROP_SYMBOLS,
];

export function getCatalogSymbol(id: string): CatalogSymbol | undefined {
  return CURTIS_CATALOG_SYMBOLS.find((s) => s.id === id);
}

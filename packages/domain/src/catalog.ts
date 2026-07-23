import type { CatalogSymbol } from "@workstream/contracts";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";
import { OPEN_CROP_SYMBOLS } from "./open-crop-symbols";
import { OSMIC_LANDSCAPE_SYMBOLS } from "./osmic-landscape-symbols";
import { PLANZV_DESIGN_SYMBOLS } from "./planzv-design-symbols";
import { TEMAKI_PLANT_SYMBOLS } from "./temaki-plant-symbols";
import { TEMAKI_SITE_SYMBOLS } from "./temaki-site-symbols";
import { WIKIMEDIA_TREE_SYMBOLS } from "./wikimedia-tree-symbols";

/**
 * Curtis library + Temaki plants/site + PlanZV + Osmic + Wikimedia trees + Open Crop.
 * Design / planting / hardscape packs listed before edible crops.
 */
export const CURTIS_CATALOG_SYMBOLS: CatalogSymbol[] = [
  ...CURTIS_DESIGN_ASSETS,
  ...TEMAKI_PLANT_SYMBOLS,
  ...TEMAKI_SITE_SYMBOLS,
  ...PLANZV_DESIGN_SYMBOLS,
  ...OSMIC_LANDSCAPE_SYMBOLS,
  ...WIKIMEDIA_TREE_SYMBOLS,
  ...OPEN_CROP_SYMBOLS,
];

export function getCatalogSymbol(id: string): CatalogSymbol | undefined {
  return CURTIS_CATALOG_SYMBOLS.find((s) => s.id === id);
}

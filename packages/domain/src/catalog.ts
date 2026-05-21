import type { CatalogSymbol } from "@workstream/contracts";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";

/** Curtis & Co design widget library (plants, hardscape, structures). */
export const CURTIS_CATALOG_SYMBOLS: CatalogSymbol[] = CURTIS_DESIGN_ASSETS;

export function getCatalogSymbol(id: string): CatalogSymbol | undefined {
  return CURTIS_CATALOG_SYMBOLS.find((s) => s.id === id);
}

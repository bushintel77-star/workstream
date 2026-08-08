/**
 * High-stakes tools auto-reveal the buildable envelope; low-stakes stay clear.
 */

import type { StudioItemType } from "../../studioCatalog";

const HIGH_STAKES_TYPES = new Set<StudioItemType>([
  "deck",
  "paving",
  "frenchdrain",
]);

const HIGH_STAKES_SYMBOL = /pool|retain|retaining|wall|hardscape|paving|deck|trench|conduit|spa|concrete|bluestone/i;

export function isHighStakesStudioType(t: StudioItemType | null | undefined): boolean {
  if (!t) return false;
  return HIGH_STAKES_TYPES.has(t);
}

export function isHighStakesSymbolId(symbolId: string | null | undefined): boolean {
  if (!symbolId) return false;
  return HIGH_STAKES_SYMBOL.test(symbolId);
}

/** Auto-show envelope when arming high-stakes place tools or trench drafting. */
export function shouldAutoShowBuildableArea(input: {
  tool: string;
  armed: StudioItemType | null;
  armedSymbolId?: string | null;
  /** Construction trench draft / ghost review in progress. */
  trenchDrafting?: boolean;
}): boolean {
  if (input.trenchDrafting) return true;
  if (input.tool !== "add" && input.tool !== "paint") return false;
  if (isHighStakesStudioType(input.armed)) return true;
  if (isHighStakesSymbolId(input.armedSymbolId)) return true;
  return false;
}

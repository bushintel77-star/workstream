import type { CatalogCategory } from "@workstream/contracts";
import type { StudioItemType } from "../../studioCatalog";
import type { RightDataPanel } from "../surfaces/rightDataLane";
import { toggleRightDataPanel } from "../surfaces/rightDataLane";

/**
 * Left asset panel — one docked slot, three states (STUDIO-SURFACES).
 * null = collapsed Fill rail; "expanded" = library; "placing" = Path Grammar.
 */
export type LeftAssetPanel = null | "expanded" | "placing";

/** Snapshot so Back from placing restores Expanded scroll/filter. */
export type LeftAssetRestore = {
  query: string;
  openSection: string | null;
  scrollTop: number;
};

/** Studio fill types that need Path Grammar before centreline draw. */
export const PATH_GRAMMAR_TYPES: ReadonlySet<StudioItemType> = new Set([
  "paving",
  "deck",
]);

export function needsPathGrammar(t: StudioItemType): boolean {
  return PATH_GRAMMAR_TYPES.has(t);
}

/** Map Fill rail type → catalog accordion section (pre-filter on expand). */
export function categoryForSwatch(
  t: StudioItemType,
): CatalogCategory | "pinned" {
  switch (t) {
    case "lawn":
    case "bed":
    case "hedge":
      return "planting";
    case "paving":
    case "deck":
      return "paving";
    default:
      return "pinned";
  }
}

export function openLeftAssetExclusive(
  panel: "expanded" | "placing",
): { leftAssetPanel: "expanded" | "placing"; rightDataPanel: null } {
  return { leftAssetPanel: panel, rightDataPanel: null };
}

export function collapseLeftAssetPanel(): {
  leftAssetPanel: null;
  leftAssetRestore: null;
} {
  return { leftAssetPanel: null, leftAssetRestore: null };
}

/** Opening a right data panel collapses Expanded/Placing (rail stays). */
export function toggleRightDataPanelExclusive(
  current: RightDataPanel | null,
  next: RightDataPanel,
): { rightDataPanel: RightDataPanel | null; leftAssetPanel: null } {
  return {
    rightDataPanel: toggleRightDataPanel(current, next),
    leftAssetPanel: null,
  };
}

export function rightPanelClearsLeft(
  panel: RightDataPanel,
): { rightDataPanel: RightDataPanel; leftAssetPanel: null } {
  return { rightDataPanel: panel, leftAssetPanel: null };
}

/** Patch helper — opening any right panel collapses Expanded/Placing. */
export function withRightDataPanel(
  panel: RightDataPanel | null,
): { rightDataPanel: RightDataPanel | null; leftAssetPanel: null } {
  return { rightDataPanel: panel, leftAssetPanel: null };
}

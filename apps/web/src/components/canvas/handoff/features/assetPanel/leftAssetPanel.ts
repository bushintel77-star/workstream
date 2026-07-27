import type { CatalogCategory } from "@workstream/contracts";
import type { StudioItemType } from "../../studioCatalog";
import type { RightDataPanel } from "../surfaces/rightDataLane";
import { toggleRightDataPanel } from "../surfaces/rightDataLane";

/**
 * Left asset panel — one docked slot, three states (STUDIO-SURFACES).
 * null = collapsed Fill rail; "expanded" = library; "placing" = Path Grammar.
 */
export type LeftAssetPanel = null | "expanded" | "placing";

/**
 * Collapsed rail clearance (--ws-safe-left): dock left (~58px) +
 * `--dock-rail-collapsed-w` (56px) + padding.
 */
export const LEFT_SAFE_COLLAPSED_PX = 120;

/** Expanded library panel clearance. */
export const LEFT_SAFE_EXPANDED_PX = 420;

/** Path Grammar placing panel clearance. */
export const LEFT_SAFE_PLACING_PX = 340;

/** Bump --ws-safe-left when the asset dock is visible. */
export function resolveLeftSafeInsetPx(
  panel: LeftAssetPanel,
  assetPanelVisible: boolean,
): number | undefined {
  if (!assetPanelVisible) return undefined;
  if (panel === "expanded") return LEFT_SAFE_EXPANDED_PX;
  if (panel === "placing") return LEFT_SAFE_PLACING_PX;
  return LEFT_SAFE_COLLAPSED_PX;
}

/** Auto-collapse library after place / canvas interact unless pinned. */
export function shouldAutoCollapseLeftAsset(args: {
  panel: LeftAssetPanel;
  pinned: boolean;
}): boolean {
  return args.panel === "expanded" && !args.pinned;
}

/** Collapse expanded library; preserve placing / pinned. */
export function collapseLeftAssetUnlessPinned(args: {
  panel: LeftAssetPanel;
  pinned: boolean;
}): { leftAssetPanel: null; leftAssetRestore: null } | null {
  if (!shouldAutoCollapseLeftAsset(args)) return null;
  return { leftAssetPanel: null, leftAssetRestore: null };
}

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
): {
  rightDataPanel: RightDataPanel | null;
  leftAssetPanel: null;
  ghostReviewOpen?: false;
} {
  const rightDataPanel = toggleRightDataPanel(current, next);
  return {
    rightDataPanel,
    leftAssetPanel: null,
    ...(rightDataPanel != null ? { ghostReviewOpen: false as const } : {}),
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
): {
  rightDataPanel: RightDataPanel | null;
  leftAssetPanel: null;
  ghostReviewOpen?: false;
} {
  return {
    rightDataPanel: panel,
    leftAssetPanel: null,
    ...(panel != null ? { ghostReviewOpen: false as const } : {}),
  };
}

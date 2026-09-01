/**
 * Vicmap government-overlay metadata — the single source of truth for overlay
 * colour and label, shared by the scene washes (GovernmentOverlays) and the
 * Layers legend so the two always agree. Raw colours come from the palette
 * tokens (no per-kind hex in handoff — CI-gated); labels are operator-case.
 */
import type { KeylessOverlayKind } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";

/** Drawn line colour per overlay kind (matches the scene washes exactly). */
export const OVERLAY_COLORS: Record<KeylessOverlayKind, string> = {
  planning: PALETTE.cobaltL600,
  bushfire: PALETTE.warningL500,
  contour: PALETTE.grayL300,
  flood: PALETTE.waterL500,
  heritage: PALETTE.autumnOrange,
  easement: PALETTE.slateL500,
  urban_tree: PALETTE.forestL600,
  water_corp: PALETTE.apwaWater,
  road_casement: PALETTE.bluestoneL400,
  acid_sulfate: PALETTE.warningL500,
  wetland: PALETTE.waterL500,
  native_vegetation: PALETTE.sproutL500,
};

/** Display label per overlay kind — the "what am I looking at" answer. */
export const OVERLAY_LABELS: Record<KeylessOverlayKind, string> = {
  planning: "Planning zone",
  bushfire: "Bushfire (BAL)",
  contour: "Contour",
  flood: "Flood / overland flow",
  heritage: "Heritage overlay",
  easement: "Easement",
  urban_tree: "Urban tree",
  water_corp: "Water Corp",
  road_casement: "Road casement",
  acid_sulfate: "Acid sulfate",
  wetland: "Wetland",
  native_vegetation: "Native vegetation",
};

/** Stable legend order (not the schema order). */
export const OVERLAY_ORDER: KeylessOverlayKind[] = [
  "planning",
  "heritage",
  "bushfire",
  "flood",
  "easement",
  "water_corp",
  "road_casement",
  "acid_sulfate",
  "wetland",
  "urban_tree",
  "native_vegetation",
  "contour",
];

/** True when the overlay kind is drawn (not in the operator's hidden set). */
export function isOverlayVisible(
  hidden: KeylessOverlayKind[],
  kind: KeylessOverlayKind,
): boolean {
  return !hidden.includes(kind);
}

import { zoneKindShortLabel } from "@workstream/domain";
import type { IrrigationZone } from "@workstream/contracts";
import { PALETTE } from "../../../../../styles/colorTokens";
import { BY_TYPE, type StudioItem, type StudioItemType } from "../../studioCatalog";

/** Live massing / material copy for Fit-sheet widgets (honest to the board). */
export type SheetWidgetContext = {
  zoneFace: string;
  zoneDetail: string;
  materialLabels: string;
  materialChips: Array<{ id: string; hex: string; label: string }>;
};

const MATERIAL_ORDER: StudioItemType[] = [
  "paving",
  "deck",
  "lawn",
  "hedge",
  "bed",
  "canopy",
  "feature",
];

const MATERIAL_HEX: Partial<Record<StudioItemType, string>> = {
  paving: PALETTE.bluestoneL400,
  deck: PALETTE.timberL400,
  lawn: PALETTE.sproutL500,
  hedge: PALETTE.hedgeL600,
  bed: PALETTE.sageL400,
  canopy: PALETTE.forestL600,
  feature: PALETTE.oliveL500,
};

/**
 * Derive Fit-sheet zone + material faces from the live board.
 * Prefers irrigation zone names; falls back to placed massing types.
 */
export function buildSheetWidgetContext(input: {
  items: StudioItem[];
  irrigationZones?: IrrigationZone[];
}): SheetWidgetContext {
  const zones = input.irrigationZones ?? [];
  const live = input.items.filter((it) => !it.ghost && it.t !== "exist");

  let zoneFace: string;
  let zoneDetail: string;
  if (zones.length > 0) {
    const labels = zones.slice(0, 3).map((z) => {
      const name = z.name?.trim();
      if (name) return name;
      return zoneKindShortLabel(z.kind);
    });
    zoneFace = labels.join(" · ");
    zoneDetail =
      zones.length > 3
        ? `${zones.length} zones on the board`
        : "From irrigation / services zones";
  } else {
    const soft = countTypes(live, ["bed", "lawn", "hedge"]);
    const hard = countTypes(live, ["paving", "deck"]);
    const trees = countTypes(live, ["canopy", "feature"]);
    const parts: string[] = [];
    if (soft > 0) parts.push("Plant massing");
    if (hard > 0) parts.push("Hardscape");
    if (trees > 0) parts.push("Canopy");
    zoneFace = parts.length > 0 ? parts.join(" · ") : "No zones drawn yet";
    zoneDetail =
      parts.length > 0
        ? "From placements on this drawing"
        : "Paint beds or draw irrigation zones";
  }

  const present = new Set(live.map((it) => it.t));
  const chips: SheetWidgetContext["materialChips"] = [];
  for (const t of MATERIAL_ORDER) {
    if (!present.has(t)) continue;
    const hex = MATERIAL_HEX[t];
    if (!hex) continue;
    chips.push({
      id: t,
      hex,
      label: BY_TYPE[t]?.tag ?? t,
    });
    if (chips.length >= 4) break;
  }

  return {
    zoneFace,
    zoneDetail,
    materialLabels:
      chips.length > 0
        ? chips.map((c) => c.label).join(" · ")
        : "Place materials on the drawing",
    materialChips: chips,
  };
}

function countTypes(items: StudioItem[], types: StudioItemType[]): number {
  const set = new Set(types);
  return items.reduce((n, it) => (set.has(it.t) ? n + 1 : n), 0);
}

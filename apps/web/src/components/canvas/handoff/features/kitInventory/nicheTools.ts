import {
  BY_TYPE,
  PAINT_SWATCHES,
  type StudioItem,
  type StudioItemType,
  type StudioMode,
} from "../../studioCatalog";

/**
 * Compact action in the near-object material fan.
 * Structure: radial slots (borrowed from marking menus / inventory grids).
 * Surface: professional materials + lock — not game loadout language.
 */
export type NicheTool = {
  id: string;
  label: string;
  icon: string;
  material?: StudioItemType;
  kind: "material" | "action";
};

const MATERIAL_FAN: readonly StudioItemType[] = PAINT_SWATCHES.map((s) => s.t);
const TREE_FAN: readonly StudioItemType[] = ["canopy", "feature"];

const ICONS: Partial<Record<StudioItemType, string>> = {
  paving: "▣",
  deck: "▤",
  lawn: "▨",
  bed: "◍",
  hedge: "▬",
  canopy: "◎",
  feature: "◉",
  frenchdrain: "〰",
  exist: "⌀",
};

function materialTools(types: readonly StudioItemType[]): NicheTool[] {
  return types.map((t) => ({
    id: `mat-${t}`,
    label: BY_TYPE[t].tag,
    icon: ICONS[t] ?? "◇",
    material: t,
    kind: "material" as const,
  }));
}

/**
 * Fan above a selected item — turf / bed / bluestone / deck (or trees).
 * Canvas-first: tools come to the selection, not a permanent left album.
 */
export function nicheToolsForItem(
  item: StudioItem,
  opts: { locked: boolean },
): NicheTool[] {
  const tools: NicheTool[] = [];

  if (item.t === "exist") {
    tools.push({
      id: "exist-mark",
      label: "Existing",
      icon: "⌀",
      kind: "action",
    });
  } else if ((TREE_FAN as readonly string[]).includes(item.t)) {
    tools.push(...materialTools(TREE_FAN));
  } else if (item.t === "frenchdrain") {
    tools.push(...materialTools(["frenchdrain"]));
  } else {
    tools.push(...materialTools(MATERIAL_FAN));
  }

  tools.push({
    id: "lock",
    label: opts.locked ? "Unlock" : "Lock",
    icon: opts.locked ? "⬡" : "⬢",
    kind: "action",
  });

  return tools;
}

/** Place palette when Add is armed — docked off the lot, not a left album. */
export function nicheToolsForPlace(mode: StudioMode): NicheTool[] {
  if (mode === "survey") {
    return materialTools(["exist"]);
  }
  return [
    ...materialTools(MATERIAL_FAN),
    ...materialTools(TREE_FAN),
    ...materialTools(["frenchdrain"]),
  ];
}

export type ZoneNicheKind = "drip" | "lighting";

export function nicheToolsForZone(): NicheTool[] {
  return [
    { id: "zone-drip", label: "Drip", icon: "〰", kind: "action" },
    { id: "zone-lighting", label: "Lighting", icon: "✦", kind: "action" },
  ];
}

export function zoneNicheActiveId(kind: ZoneNicheKind): string {
  return kind === "drip" ? "zone-drip" : "zone-lighting";
}

export function nicheActiveIdForItem(item: StudioItem): string {
  if (item.t === "exist") return "exist-mark";
  return `mat-${item.t}`;
}

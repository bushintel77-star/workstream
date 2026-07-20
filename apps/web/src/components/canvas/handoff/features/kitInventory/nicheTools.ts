import { BY_TYPE, type StudioItem, type StudioItemType } from "../../studioCatalog";

/** Compact action shown in the near-object 180° niche carousel. */
export type NicheTool = {
  id: string;
  label: string;
  icon: string;
  /** When set, equipping swaps the selected item’s type. */
  material?: StudioItemType;
  kind: "material" | "action";
};

const HARD: readonly StudioItemType[] = ["paving", "deck"];
const SOFT: readonly StudioItemType[] = ["lawn", "bed", "hedge"];
const TREES: readonly StudioItemType[] = ["canopy", "feature"];

function familyOf(t: StudioItemType): readonly StudioItemType[] {
  if ((HARD as readonly string[]).includes(t)) return HARD;
  if ((SOFT as readonly string[]).includes(t)) return SOFT;
  if ((TREES as readonly string[]).includes(t)) return TREES;
  if (t === "frenchdrain") return ["frenchdrain"];
  if (t === "exist") return ["exist"];
  return [t];
}

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

/**
 * Limited niche tools for a selected object — not the full design kit.
 * Material siblings + peel / lock.
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
  } else {
    for (const t of familyOf(item.t)) {
      tools.push({
        id: `mat-${t}`,
        label: BY_TYPE[t].tag,
        icon: ICONS[t] ?? "◇",
        material: t,
        kind: "material",
      });
    }
  }

  tools.push({
    id: "peel",
    label: "Peel",
    icon: "◌",
    kind: "action",
  });
  tools.push({
    id: "lock",
    label: opts.locked ? "Unlock" : "Lock",
    icon: opts.locked ? "⬡" : "⬢",
    kind: "action",
  });

  return tools;
}

export type ZoneNicheKind = "drip" | "lighting";

export function nicheToolsForZone(): NicheTool[] {
  return [
    {
      id: "zone-drip",
      label: "Drip",
      icon: "〰",
      kind: "action",
    },
    {
      id: "zone-lighting",
      label: "Lighting",
      icon: "✦",
      kind: "action",
    },
  ];
}

export function zoneNicheActiveId(kind: ZoneNicheKind): string {
  return kind === "drip" ? "zone-drip" : "zone-lighting";
}

export function nicheActiveIdForItem(item: StudioItem): string {
  if (item.t === "exist") return "exist-mark";
  return `mat-${item.t}`;
}

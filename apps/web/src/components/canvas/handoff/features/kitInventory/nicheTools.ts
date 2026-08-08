import {
  BY_TYPE,
  KIT_BAGS,
  kitBagFor,
  type KitBagId,
  type StudioItem,
  type StudioItemType,
  type StudioMode,
} from "../../studioCatalog";

/**
 * Compact action in the near-object / place kit fan.
 * Structure: radial slots with bag progressive disclosure (Soft / Hard / Trees / Water).
 * Surface: professional materials + lock — not game loadout language.
 */
export type NicheTool = {
  id: string;
  label: string;
  icon: string;
  material?: StudioItemType;
  bag?: KitBagId;
  kind: "material" | "action" | "bag" | "back";
};

const PLACE_BAGS: readonly KitBagId[] = ["soft", "hard", "trees", "water"];

/** Fillable surfaces swap within soft + hard only. */
const FILL_BAGS: readonly KitBagId[] = ["soft", "hard"];

const BAG_ICONS: Record<KitBagId, string> = {
  soft: "▨",
  hard: "▣",
  trees: "◎",
  water: "〰",
  all: "◇",
};

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

function bagTool(id: KitBagId): NicheTool {
  const bag = KIT_BAGS.find((b) => b.id === id);
  return {
    id: `bag-${id}`,
    label: bag?.label ?? id,
    icon: BAG_ICONS[id],
    bag: id,
    kind: "bag",
  };
}

function backTool(): NicheTool {
  return {
    id: "bag-back",
    label: "Families",
    icon: "◂",
    kind: "back",
  };
}

function lockTool(locked: boolean): NicheTool {
  return {
    id: "lock",
    label: locked ? "Unlock" : "Lock",
    icon: locked ? "⬡" : "⬢",
    kind: "action",
  };
}

function typesForBag(bagId: KitBagId, mode: StudioMode): StudioItemType[] {
  const bag = KIT_BAGS.find((b) => b.id === bagId);
  if (!bag) return [];
  if (mode === "survey") {
    return bag.types.filter((t) => t === "exist");
  }
  return [...bag.types];
}

/**
 * Fan tools for a selected item — bag families first, then materials in the open bag.
 * Keeps the radial short (Soft / Hard) instead of every swatch at once.
 * Lock lives on SelectionRing when `includeLock` is false (gold: one job per control).
 */
export function nicheToolsForItem(
  item: StudioItem,
  opts: {
    locked: boolean;
    openBag?: KitBagId | null;
    includeLock?: boolean;
  },
): NicheTool[] {
  const openBag = opts.openBag ?? null;
  const withLock = opts.includeLock !== false;
  const lock = withLock ? [lockTool(opts.locked)] : [];

  if (item.t === "exist") {
    return [
      {
        id: "exist-mark",
        label: "Existing",
        icon: "⌀",
        kind: "action",
      },
      ...lock,
    ];
  }

  const homeBag = kitBagFor(item.t);

  if (openBag) {
    const types = typesForBag(openBag, "cad").filter((t) => t !== "exist");
    return [...materialTools(types), backTool(), ...lock];
  }

  /* Trees / water are already small — show siblings, no bag step. */
  if (homeBag === "trees" || homeBag === "water") {
    const types = typesForBag(homeBag, "cad").filter((t) => t !== "exist");
    return [...materialTools(types), ...lock];
  }

  /* Soft / hard fillables — pick a family, then a material. */
  return [...FILL_BAGS.map(bagTool), ...lock];
}

/**
 * Place palette when Add is armed — same Soft / Hard / Trees / Water bags as selection.
 */
export function nicheToolsForPlace(
  mode: StudioMode,
  openBag: KitBagId | null = null,
): NicheTool[] {
  if (mode === "survey") {
    return materialTools(["exist"]);
  }

  if (openBag) {
    return [...materialTools(typesForBag(openBag, mode)), backTool()];
  }

  return PLACE_BAGS.map(bagTool);
}

export type ZoneNicheKind =
  | "drip"
  | "lighting"
  | "lighting_conduit"
  | "spray"
  | "agg_drain";

export function nicheToolsForZone(): NicheTool[] {
  return [
    { id: "zone-drip", label: "Drip", icon: "〰", kind: "action" },
    { id: "zone-lighting", label: "Lighting", icon: "✦", kind: "action" },
    { id: "zone-conduit", label: "LV trench", icon: "⌁", kind: "action" },
    { id: "zone-spray", label: "Spray", icon: "◎", kind: "action" },
    { id: "zone-agg", label: "Agg drain", icon: "≂", kind: "action" },
  ];
}

export function zoneNicheActiveId(kind: ZoneNicheKind): string {
  switch (kind) {
    case "lighting":
      return "zone-lighting";
    case "lighting_conduit":
      return "zone-conduit";
    case "spray":
      return "zone-spray";
    case "agg_drain":
      return "zone-agg";
    case "drip":
    default:
      return "zone-drip";
  }
}

export function nicheActiveIdForItem(
  item: StudioItem,
  openBag: KitBagId | null = null,
): string {
  if (item.t === "exist") return "exist-mark";
  const home = kitBagFor(item.t);
  if (home === "trees" || home === "water") return `mat-${item.t}`;
  if (openBag) return `mat-${item.t}`;
  return `bag-${home === "all" ? "soft" : home}`;
}

export function nicheActiveIdForPlace(
  armed: StudioItemType | null,
  openBag: KitBagId | null,
): string | null {
  if (openBag && armed) return `mat-${armed}`;
  if (openBag) return `bag-${openBag}`;
  if (armed) {
    const bag = kitBagFor(armed);
    return bag === "all" ? null : `bag-${bag}`;
  }
  return null;
}

/** Materials currently visible in a bag fan (for digit accelerators). */
export function nicheVisibleMaterials(tools: readonly NicheTool[]): StudioItemType[] {
  return tools
    .filter((t) => t.kind === "material" && t.material)
    .map((t) => t.material!);
}

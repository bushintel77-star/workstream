import { BY_TYPE, type StudioItemType, type StudioMode } from "../../studioCatalog";

/** Cap session recents feeding the command palette. */
export const RECENT_ASSET_CAP = 8;

/**
 * Canonical rate-card SKUs per studio type (must exist in seed rate-card.json).
 * Drift-tested — do not add aliases here.
 */
export const STUDIO_TYPE_SKUS: Record<StudioItemType, readonly string[]> = {
  canopy: ["PLT-100L", "PLT-MAG-LG-100"],
  feature: ["PLT-CYCAS-400", "PLT-PHO-200"],
  paving: ["PAV-BLUE-SAWN", "PAV-BLUE-FLAME"],
  deck: ["TIM-DECK-SUP", "LGT-DECK-STRIP"],
  lawn: ["SOIL-TOP", "MULCH-PINE"],
  hedge: ["PLT-LOM-140", "TSK-PLNT-HEDGE"],
  bed: ["PLT-LIGULARIA-140", "MULCH-PINE"],
  frenchdrain: ["DRN-AG-100", "DRN-AG-INST"],
  exist: ["TSK-PLEACH-TRAIN"],
};

/**
 * Loose search aliases (names / catalog codes) — not drift-tested against rate card.
 */
export const STUDIO_TYPE_SEARCH_ALIASES: Record<
  StudioItemType,
  readonly string[]
> = {
  canopy: ["CANOPY", "PLT-HORN", "PLT-CANOPY"],
  feature: ["FEATURE", "PLT-WEST", "PLT-FEATURE"],
  paving: ["PAVING", "BLUESTONE", "PAV-BLUE"],
  deck: ["DECK", "TIMBER-DECK"],
  lawn: ["LAWN", "TURF"],
  hedge: ["HEDGE", "LOMANDRA"],
  bed: ["BED", "PLANTING"],
  frenchdrain: ["DRAIN", "FRENCH", "TRENCH-DRAIN"],
  exist: ["EXIST", "TRP-TPZ"],
};

function searchKeys(type: StudioItemType): string[] {
  return [
    ...STUDIO_TYPE_SKUS[type],
    ...STUDIO_TYPE_SEARCH_ALIASES[type],
  ].map((s) => s.toLowerCase());
}

export type AssetCategory = "planting" | "paving" | "drainage" | "other";

export function categoryForStudioType(t: StudioItemType): AssetCategory {
  switch (t) {
    case "canopy":
    case "feature":
    case "lawn":
    case "hedge":
    case "bed":
      return "planting";
    case "paving":
    case "deck":
      return "paving";
    case "frenchdrain":
      return "drainage";
    default:
      return "other";
  }
}

/** Types boosted when sketching / CAD planting is the active mode. */
const MODE_BOOST: Partial<Record<StudioMode, readonly AssetCategory[]>> = {
  sketch: ["planting", "paving"],
  cad: ["planting", "paving", "drainage"],
  survey: ["other"],
  elevation: ["planting"],
  quote: [],
  share: [],
};

export function pushRecentAssetType(
  recents: readonly StudioItemType[],
  type: StudioItemType,
  cap = RECENT_ASSET_CAP,
): StudioItemType[] {
  const next = [type, ...recents.filter((t) => t !== type)];
  return next.slice(0, cap);
}

type Ranked = { type: StudioItemType; score: number };

function scoreType(
  type: StudioItemType,
  query: string,
  recents: readonly StudioItemType[],
  mode: StudioMode,
): number {
  const def = BY_TYPE[type];
  const name = def.name.toLowerCase();
  const tag = def.tag.toLowerCase();
  const skus = searchKeys(type);
  const q = query.trim().toLowerCase();
  const recentIdx = recents.indexOf(type);
  const recentBoost = recentIdx >= 0 ? 50 - recentIdx : 0;
  const cats = MODE_BOOST[mode] ?? [];
  const modeBoost = cats.includes(categoryForStudioType(type)) ? 30 : 0;

  if (!q) {
    const cat = categoryForStudioType(type);
    const catBias =
      cat === "planting" ? 40 : cat === "paving" ? 20 : cat === "drainage" ? 10 : 0;
    return recentBoost * 10 + modeBoost + catBias + (100 - name.charCodeAt(0));
  }

  let band = 0;
  if (skus.some((s) => s === q)) band = 1000;
  else if (skus.some((s) => s.startsWith(q) || q.startsWith(s))) band = 900;
  else if (name.startsWith(q) || tag.startsWith(q)) band = 800;
  else if (
    categoryForStudioType(type).startsWith(q) ||
    name.split(/\s+/).some((w) => w.startsWith(q))
  ) {
    band = 600;
  } else if (
    name.includes(q) ||
    tag.includes(q) ||
    skus.some((s) => s.includes(q))
  ) {
    band = 400;
  } else {
    const toks = q.split(/\s+/).filter(Boolean);
    const hay = `place add ${name} ${tag} ${skus.join(" ")}`;
    if (toks.every((tok) => hay.includes(tok))) band = 300;
    else return -1;
  }

  return band + recentBoost + modeBoost;
}

/**
 * Rank placeable studio types for the command palette.
 * Order: exact SKU > name prefix > category > substring, then recents + mode.
 */
export function rankAssetCommands(args: {
  query: string;
  types?: readonly StudioItemType[];
  recents?: readonly StudioItemType[];
  mode?: StudioMode;
}): StudioItemType[] {
  const types =
    args.types ??
    (Object.keys(BY_TYPE) as StudioItemType[]).filter(
      (t) => !BY_TYPE[t].existing,
    );
  const recents = args.recents ?? [];
  const mode = args.mode ?? "sketch";

  const ranked: Ranked[] = [];
  for (const type of types) {
    const score = scoreType(type, args.query, recents, mode);
    if (score < 0) continue;
    ranked.push({ type, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return BY_TYPE[a.type].name.localeCompare(BY_TYPE[b.type].name);
  });
  return ranked.map((r) => r.type);
}

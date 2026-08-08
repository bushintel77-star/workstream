import type { CatalogAsset, CatalogSymbol } from "@workstream/contracts";

/**
 * Curtis garden size ladder — named mature-height steps per asset family.
 *
 * The studio elevation draws a *placed* asset's real height. Height is derived
 * from the placed `symbol_id` (CatalogPlacement carries no height field), so
 * every rung of the ladder has to exist as its own catalog symbol for the
 * number to survive a save / reload. These symbols *are* the ladder and
 * `mature_height_m` is the contract every elevation surface reads.
 *
 * Domain-pure: no DOM, no server imports.
 */

export type GardenAssetFamily = "tree" | "screen" | "hedge" | "shrub" | "deck";

/** Coarse studio glyph the rung places as (web `StudioItemType`). */
export type GardenLadderStudioType = "canopy" | "feature" | "hedge" | "deck";

export type GardenSizeStep = {
  /** Catalog symbol id — `curtis-<family>-<height in cm, 3 digits>`. */
  id: string;
  family: GardenAssetFamily;
  /** Mature height (m) — the number the elevation draws and labels. */
  heightM: number;
  /** Mature spread / platform width (m) — drives elevation bar width. */
  spreadM: number;
  /** Palette + elevation label, e.g. `Canopy tree · 7.8 m`. */
  label: string;
  studioType: GardenLadderStudioType;
};

export const GARDEN_LADDER_ID_RE = /^curtis-(tree|screen|hedge|shrub|deck)-\d{3}$/;

export function isGardenLadderId(id: string): boolean {
  return GARDEN_LADDER_ID_RE.test(id.trim().toLowerCase());
}

/**
 * Curtis material ink for ladder palette cards. Literal paint values, mirroring
 * the accents already used in `catalog-assets.ts` — catalog art is data, not
 * web chrome (chrome colour lives in `--hc-*` tokens and is CI-gated).
 */
const LADDER_INK = {
  canopyFill: "#3d6b3a",
  canopyEdge: "#2a4d28",
  canopyLight: "#5c8f55",
  trunk: "#5c4a32",
  hedgeFill: "#4a6741",
  hedgeEdge: "#2d4a28",
  hedgeLight: "#7da872",
  timberFill: "#8b6914",
  timberEdge: "#5c4610",
  timberDark: "#6b5010",
  ground: "#8a7a5c",
  plantingCard: "#e8f0e6",
  timberCard: "#f5ead8",
} as const;

/** Palette card geometry (48x48 viewBox, shared by every rung). */
const CARD_GROUND_Y = 42;
const CARD_TOP_Y = 6;
const CARD_DRAW_H = CARD_GROUND_Y - CARD_TOP_Y;

function n(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function circlePath(cx: number, cy: number, r: number): string {
  const d = r * 2;
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(d)} 0 ${n(r)} ${n(r)} 0 0 0 ${n(-d)} 0`;
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
}

const groundLayer = (): CatalogAsset["layers"][number] => ({
  d: `M6 ${CARD_GROUND_Y}h36`,
  stroke: LADDER_INK.ground,
  stroke_width: 1,
  opacity: 0.35,
});

/**
 * Tree card — crown sitting on a clear stem, drawn at `rel` of the tallest rung
 * in its family so the ladder reads as a ladder on the palette.
 */
function treeAsset(rel: number): CatalogAsset {
  const totalH = CARD_DRAW_H * rel;
  const crownR = (totalH * 0.68) / 2;
  const trunkH = totalH - crownR * 2;
  const trunkTopY = CARD_GROUND_Y - trunkH;
  const crownCy = trunkTopY - crownR;
  return {
    view_box: "0 0 48 48",
    layers: [
      groundLayer(),
      {
        d: `M24 ${CARD_GROUND_Y}V${n(trunkTopY)}`,
        stroke: LADDER_INK.trunk,
        stroke_width: 2.2,
      },
      {
        d: circlePath(24, crownCy, crownR),
        fill: LADDER_INK.canopyFill,
        stroke: LADDER_INK.canopyEdge,
        stroke_width: 1,
      },
      {
        d: circlePath(24 - crownR * 0.3, crownCy - crownR * 0.25, crownR * 0.45),
        fill: LADDER_INK.canopyLight,
        opacity: 0.45,
      },
    ],
    preview_bg: LADDER_INK.plantingCard,
    accent: LADDER_INK.canopyFill,
  };
}

/** Hedge card — clipped block with topiary ticks along the cut line. */
function hedgeAsset(rel: number): CatalogAsset {
  const totalH = CARD_DRAW_H * rel;
  const topY = CARD_GROUND_Y - totalH;
  const tickR = Math.min(3, totalH * 0.16);
  return {
    view_box: "0 0 48 48",
    layers: [
      groundLayer(),
      {
        d: rectPath(8, topY, 32, totalH),
        fill: LADDER_INK.hedgeFill,
        stroke: LADDER_INK.hedgeEdge,
        stroke_width: 1,
      },
      {
        d: [12, 20, 28, 36]
          .map((cx) => circlePath(cx, topY, tickR))
          .join(""),
        fill: "none",
        stroke: LADDER_INK.hedgeLight,
        stroke_width: 0.8,
      },
      {
        d: `M8 ${n(topY + totalH * 0.45)}h32`,
        stroke: LADDER_INK.hedgeLight,
        stroke_width: 0.6,
        opacity: 0.3,
      },
    ],
    preview_bg: LADDER_INK.plantingCard,
    accent: LADDER_INK.hedgeFill,
  };
}

/** Deck card — platform, board joints, fascia and posts down to ground. */
function deckAsset(): CatalogAsset {
  const plateY = 28;
  const plateH = 5;
  const fasciaY = plateY + plateH;
  return {
    view_box: "0 0 48 48",
    layers: [
      groundLayer(),
      {
        d: rectPath(6, plateY, 36, plateH),
        fill: LADDER_INK.timberFill,
        stroke: LADDER_INK.timberEdge,
        stroke_width: 1,
      },
      {
        d: [12, 18, 24, 30, 36]
          .map((x) => `M${x} ${plateY}v${plateH}`)
          .join(""),
        stroke: LADDER_INK.timberDark,
        stroke_width: 0.6,
      },
      {
        d: rectPath(6, fasciaY, 36, 2.5),
        fill: LADDER_INK.timberDark,
      },
      {
        d: `M10 ${n(fasciaY + 2.5)}v${n(CARD_GROUND_Y - fasciaY - 2.5)}M38 ${n(fasciaY + 2.5)}v${n(CARD_GROUND_Y - fasciaY - 2.5)}`,
        stroke: LADDER_INK.timberEdge,
        stroke_width: 2,
      },
    ],
    preview_bg: LADDER_INK.timberCard,
    accent: LADDER_INK.timberFill,
  };
}

/** Compact legacy path per family (map-pin fallback renderers). */
const FAMILY_PATH_D: Record<GardenAssetFamily, string> = {
  tree: "M12 20V8M12 8a6 6 0 1012 0",
  screen: "M4 20h16V4h-4v16",
  hedge: "M4 10h16v12H4z",
  shrub: "M6 20a6 6 0 1012 0",
  deck: "M3 12h18v3H3zm0 5h18v3H3z",
};

type LadderSpec = {
  family: GardenAssetFamily;
  studioType: GardenLadderStudioType;
  name: string;
  category: CatalogSymbol["category"];
  description: string;
  keywords: string[];
  /** Tallest rung in the family — palette cards scale against it. */
  refHeightM: number;
  steps: ReadonlyArray<{ heightM: number; spreadM: number }>;
};

/**
 * The ladder. Trees 7.8 / 6.9 / 5.0 / 3.5 m · hedges 1.8 / 1.4 / 1.2 / 0.9 m ·
 * deck 0.5 m. Heights are Melbourne residential mature sizes, not lot maxima.
 */
const LADDER_SPECS: readonly LadderSpec[] = [
  {
    family: "tree",
    studioType: "canopy",
    name: "Canopy tree",
    category: "planting",
    description: "Curtis size ladder — canopy tree at mature height",
    keywords: ["tree", "canopy", "shade", "ladder", "elevation"],
    refHeightM: 7.8,
    steps: [
      { heightM: 7.8, spreadM: 6.5 },
      { heightM: 6.9, spreadM: 5.6 },
    ],
  },
  {
    family: "tree",
    studioType: "feature",
    name: "Feature tree",
    category: "planting",
    description: "Curtis size ladder — feature / specimen tree at mature height",
    keywords: ["tree", "feature", "specimen", "ladder", "elevation"],
    refHeightM: 7.8,
    steps: [
      { heightM: 5, spreadM: 4 },
      { heightM: 3.5, spreadM: 3 },
    ],
  },
  {
    family: "hedge",
    studioType: "hedge",
    name: "Clipped hedge",
    category: "planting",
    description: "Curtis size ladder — clipped hedge at maintained height",
    keywords: ["hedge", "screen", "clipped", "ladder", "elevation"],
    refHeightM: 1.8,
    steps: [
      { heightM: 1.8, spreadM: 0.9 },
      { heightM: 1.4, spreadM: 0.7 },
      { heightM: 1.2, spreadM: 0.6 },
      { heightM: 0.9, spreadM: 0.5 },
    ],
  },
  {
    family: "deck",
    studioType: "deck",
    name: "Timber deck",
    category: "paving",
    description: "Curtis size ladder — timber deck platform above ground",
    keywords: ["deck", "timber", "platform", "ladder", "elevation"],
    refHeightM: 0.5,
    steps: [{ heightM: 0.5, spreadM: 3.6 }],
  },
];

/** `7.8` → `780`, `0.5` → `050` — stable, sortable id suffix. */
export function ladderHeightCode(heightM: number): string {
  return String(Math.round(heightM * 100)).padStart(3, "0");
}

function ladderLabel(name: string, heightM: number): string {
  return `${name} · ${heightM.toFixed(1)} m`;
}

function assetForFamily(
  family: GardenAssetFamily,
  heightM: number,
  refHeightM: number,
): CatalogAsset {
  const rel = Math.max(0.18, Math.min(1, heightM / refHeightM));
  if (family === "deck") return deckAsset();
  if (family === "hedge" || family === "shrub") return hedgeAsset(rel);
  return treeAsset(rel);
}

const LADDER_ROWS = LADDER_SPECS.flatMap((spec) =>
  spec.steps.map((step) => {
    const id = `curtis-${spec.family}-${ladderHeightCode(step.heightM)}`;
    const label = ladderLabel(spec.name, step.heightM);
    const sizeKeyword = step.heightM.toFixed(1);
    const gardenStep: GardenSizeStep = {
      id,
      family: spec.family,
      heightM: step.heightM,
      spreadM: step.spreadM,
      label,
      studioType: spec.studioType,
    };
    const symbol: CatalogSymbol = {
      id,
      label,
      category: spec.category,
      description: `${spec.description} (${step.heightM.toFixed(1)} m)`,
      keywords: [...spec.keywords, sizeKeyword, `${sizeKeyword}m`],
      mature_height_m: step.heightM,
      default_width_m: step.spreadM,
      path_d: FAMILY_PATH_D[spec.family],
      asset: assetForFamily(spec.family, step.heightM, spec.refHeightM),
    };
    return { gardenStep, symbol };
  }),
);

/** Every rung, family order then tallest first. */
export const GARDEN_SIZE_LADDER: readonly GardenSizeStep[] = LADDER_ROWS.map(
  (row) => row.gardenStep,
);

/** Ladder rungs as catalog symbols — merged into `CURTIS_CATALOG_SYMBOLS`. */
export const CURTIS_GARDEN_LADDER_ASSETS: CatalogSymbol[] = LADDER_ROWS.map(
  (row) => row.symbol,
);

const LADDER_BY_ID = new Map(
  GARDEN_SIZE_LADDER.map((step) => [step.id, step] as const),
);

export function gardenSizeStep(id: string): GardenSizeStep | undefined {
  return LADDER_BY_ID.get(id.trim().toLowerCase());
}

export function gardenLadderSteps(
  family: GardenAssetFamily,
): GardenSizeStep[] {
  return GARDEN_SIZE_LADDER.filter((step) => step.family === family);
}

/** Closest rung by height — snaps a measured/AI height onto the ladder. */
export function nearestLadderStep(
  family: GardenAssetFamily,
  heightM: number,
): GardenSizeStep | undefined {
  const pool = gardenLadderSteps(family);
  if (pool.length === 0) return undefined;
  return pool.reduce((best, step) =>
    Math.abs(step.heightM - heightM) < Math.abs(best.heightM - heightM)
      ? step
      : best,
  );
}

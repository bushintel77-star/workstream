import type { CatalogCategory, CatalogSymbol } from "@workstream/contracts";

/**
 * Gold-standard sketching library – only symbols fit for 2026 one-canvas design.
 * Criteria: design-grade glyph, default_width_m, landscape-relevant,
 * no edible-crop noise, no hollow planning frames.
 */

const CURTIS_GOLD_IDS = new Set([
  "hornbeam-pleached",
  "lomandra-mass",
  "agapanthus-drift",
  "box-ball",
  "olive-standard",
  "liriope-edge",
  "lawn-turf",
  "bluestone-paver",
  "granite-stepper",
  "sandstone-crazy",
  "basalt-grid",
  "gravel-mulch",
  "timber-deck",
  "pergola",
  "retaining-wall",
  "pool",
  "spa-plunge",
  "seat-wall",
  "fire-pit",
  "existing-tree-retain",
  "tree-root-protection",
]);

const OSMIC_GOLD =
  /^osmic-(nature-tree|outdoor-(bench|fountain|table|shelter)|barrier-(gate|steps|bollard)|shop-garden-centre|tourism-viewpoint)/;

const PLANZV_GOLD =
  /^planzv-(parkanlage|dauerkleingaerten|erholungswald|schutzspflanzung|verkehrsbegleitgruen|begruenter|eigentuemergarten|wasser|naturschutz|landschaftsschutz|naturdenkmal)/;

const CATEGORY_ORDER: CatalogCategory[] = [
  "planting",
  "paving",
  "structure",
  "water",
  "furniture",
  "annotation",
];

export function isSketchGoldStandard(symbol: CatalogSymbol): boolean {
  if (!symbol.default_width_m || symbol.default_width_m <= 0) return false;
  if (!symbol.path_d && !symbol.asset?.layers?.length) return false;
  if (symbol.id.startsWith("opencrop-")) return false;
  if (CURTIS_GOLD_IDS.has(symbol.id)) return true;
  if (symbol.id.startsWith("wikimedia-tree-")) return true;
  if (OSMIC_GOLD.test(symbol.id)) return true;
  if (PLANZV_GOLD.test(symbol.id)) return true;
  return false;
}

export type SketchRibbonTab =
  | "essentials"
  | "planting"
  | "hardscape"
  | "ai";

export function selectSketchRibbonSymbols(
  symbols: CatalogSymbol[],
  tab: SketchRibbonTab = "essentials",
  limit = 14,
): CatalogSymbol[] {
  let pool = symbols.filter(isSketchGoldStandard);

  if (tab === "planting") {
    pool = pool.filter((s) => s.category === "planting");
  } else if (tab === "hardscape") {
    pool = pool.filter((s) =>
      ["paving", "structure", "water", "furniture"].includes(s.category),
    );
  } else if (tab === "ai") {
    pool = pool.filter(
      (s) =>
        s.id.startsWith("planzv-") ||
        s.id.startsWith("osmic-") ||
        s.id.startsWith("wikimedia-") ||
        (s.keywords ?? []).some((k) => /ai cad|design library/i.test(k)),
    );
  } else {
    const curtis = pool.filter((s) => CURTIS_GOLD_IDS.has(s.id));
    const rest = pool.filter((s) => !CURTIS_GOLD_IDS.has(s.id));
    pool = [...curtis, ...rest];
  }

  const rank = (s: CatalogSymbol) => {
    const cat = CATEGORY_ORDER.indexOf(s.category);
    const curtisBoost = CURTIS_GOLD_IDS.has(s.id) ? 0 : 10;
    return curtisBoost + (cat < 0 ? 50 : cat);
  };

  return [...pool].sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

/** Default brushes pre-loaded into the 2026 ribbon swatch row. */
export const SKETCH_RIBBON_STARTERS = [
  "hornbeam-pleached",
  "lomandra-mass",
  "bluestone-paver",
  "olive-standard",
  "tree-root-protection",
] as const;

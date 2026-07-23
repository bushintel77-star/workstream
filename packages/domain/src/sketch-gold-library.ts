import {
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
  type CatalogSymbol,
} from "@workstream/contracts";

/**
 * Gold-standard sketching library - only symbols fit for 2026 one-canvas design.
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
  "westringia-hedge",
  "dianella-clump",
  "kangaroo-paw",
  "correa-shrub",
  "pittosporum-hedge",
  "carex-groundcover",
  "dichondra-carpet",
  "rhaphiolepis-shrub",
  "trachelospermum-ground",
  "callistemon-shrub",
  "grevillea-shrub",
  "banksia-shrub",
  "photinia-hedge",
  "syzygium-hedge",
  "coprosma-shrub",
  "myoporum-ground",
  "viola-ground",
  "mondo-edge",
  "poa-grass",
  "themeda-grass",
  "miscanthus-grass",
  "tree-fern",
  "birdsnest-fern",
  "boston-ivy",
  "bamboo-screen",
  "magnolia-little-gem",
  "pyrus-capital",
  "cycas-revoluta",
  "ligularia-clump",
  "lavender-drift",
  "rosemary-hedge",
  "citrus-standard",
  "salvia-drift",
  "hedge-clip-formal",
  "bluestone-paver",
  "granite-stepper",
  "sandstone-crazy",
  "basalt-grid",
  "gravel-mulch",
  "timber-deck",
  "porcelain-tile",
  "exposed-aggregate",
  "bluestone-step",
  "limestone-coping",
  "timber-edging",
  "hoggin-path",
  "pergola",
  "retaining-wall",
  "sleeper-wall",
  "pool-fence",
  "privacy-screen",
  "side-gate",
  "pool",
  "spa-plunge",
  "seat-wall",
  "fire-pit",
  "brass-uplight",
  "brass-bollard-light",
  "led-graze-tape",
  "deck-strip-light",
  "path-spike-light",
  "wall-wash-light",
  "underwater-pool-light",
  "existing-tree-retain",
  "tree-root-protection",
]);

const OSMIC_GOLD =
  /^osmic-(nature-tree|outdoor-(bench|fountain|table|shelter)|barrier-(gate|steps|bollard)|shop-garden-centre|tourism-viewpoint)/;

const PLANZV_GOLD =
  /^planzv-(parkanlage|dauerkleingaerten|erholungswald|schutzspflanzung|verkehrsbegleitgruen|begruenter|eigentuemergarten|wasser|naturschutz|landschaftsschutz|naturdenkmal)/;

const TEMAKI_PLANT_GOLD =
  /^temaki-(shrub|shrub-low|plant|grass|hedge|lawn|garden-bed|tree-)/;

const TEMAKI_SITE_GOLD =
  /^temaki-(wall|gate|tall-gate|bollard|bollard-row|bridge|railing|guard-rail|rope-fence|kerb-|street-lamp-arm|mast-lighting|bench|fountain|spa|campfire|fireplace|picnic-shelter|sculpture|speed-table|waste|utility-pole)/;

const CATEGORY_ORDER: CatalogCategory[] = [
  "planting",
  "paving",
  "structure",
  "water",
  "furniture",
  "lighting",
  "annotation",
];

export function isSketchGoldStandard(symbol: CatalogSymbol): boolean {
  if (!symbol.default_width_m || symbol.default_width_m <= 0) return false;
  if (!symbol.path_d && !symbol.asset?.layers?.length) return false;
  if (symbol.id.startsWith("opencrop-")) return false;
  if (CURTIS_GOLD_IDS.has(symbol.id)) return true;
  if (symbol.id.startsWith("wikimedia-tree-")) return true;
  if (TEMAKI_PLANT_GOLD.test(symbol.id)) return true;
  if (TEMAKI_SITE_GOLD.test(symbol.id)) return true;
  if (OSMIC_GOLD.test(symbol.id)) return true;
  if (PLANZV_GOLD.test(symbol.id)) return true;
  return false;
}

/** Curtis-first, then alphabetical — deterministic order inside a category. */
function compareLibrarySymbols(a: CatalogSymbol, b: CatalogSymbol): number {
  const boost =
    (CURTIS_GOLD_IDS.has(a.id) ? 0 : 1) - (CURTIS_GOLD_IDS.has(b.id) ? 0 : 1);
  if (boost !== 0) return boost;
  return a.label.localeCompare(b.label, "en-AU");
}

export type SketchLibraryGroup = {
  category: CatalogCategory;
  label: string;
  symbols: CatalogSymbol[];
};

/**
 * Full fold-out library: every gold symbol grouped by catalog category in
 * plan-reading order. Empty categories are omitted.
 */
export function buildSketchLibraryGroups(
  symbols: CatalogSymbol[],
): SketchLibraryGroup[] {
  const pool = symbols.filter(isSketchGoldStandard);
  return CATEGORY_ORDER.flatMap((category) => {
    const inCategory = pool
      .filter((s) => s.category === category)
      .sort(compareLibrarySymbols);
    if (inCategory.length === 0) return [];
    return [
      {
        category,
        label: CATALOG_CATEGORY_LABELS[category],
        symbols: inCategory,
      },
    ];
  });
}

/**
 * Search the gold library — label, botanical name, keywords, id.
 * Label matches outrank keyword matches; Curtis assets outrank packs.
 */
export function searchSketchLibrary(
  symbols: CatalogSymbol[],
  query: string,
  limit = 48,
): CatalogSymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool = symbols.filter(isSketchGoldStandard);

  const band = (s: CatalogSymbol): number => {
    const label = s.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    if ((s.botanical_name ?? "").toLowerCase().includes(q)) return 2;
    const rest = [s.id, ...(s.keywords ?? [])].join(" ").toLowerCase();
    if (rest.includes(q)) return 3;
    return -1;
  };

  return pool
    .map((s) => ({ s, band: band(s) }))
    .filter((r) => r.band >= 0)
    .sort((a, b) => a.band - b.band || compareLibrarySymbols(a.s, b.s))
    .slice(0, limit)
    .map((r) => r.s);
}


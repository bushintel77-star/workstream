import type { CatalogAsset, CatalogCategory, CatalogSymbol } from "@workstream/contracts";

const G = (layers: CatalogAsset["layers"], preview_bg: string, accent: string): CatalogAsset => ({
  view_box: "0 0 48 48",
  layers,
  preview_bg,
  accent,
});

/** Curtis & Co landscape CAD widget library — plants, hardscape, structures. */
export const CURTIS_DESIGN_ASSETS: CatalogSymbol[] = [
  /* —— Planting —— */
  {
    id: "hornbeam-pleached",
    label: "Pleached hornbeam",
    category: "planting",
    description: "Formal pleached screen — Curtis house style",
    keywords: ["screen", "hedge", "deciduous"],
    path_d: "M4 20V8l4-4 4 4v12M12 20V4l4 4 4-4v16",
    asset: G(
      [
        { d: "M8 40V18l4-6 4 6v22", fill: "#4a6741", stroke: "#2d4a28", stroke_width: 1 },
        { d: "M24 40V10l5 8 5-8v30", fill: "#5c7a52", stroke: "#2d4a28", stroke_width: 1 },
        { d: "M6 16h20", stroke: "#8fbc8f", stroke_width: 2 },
      ],
      "#e8f0e6",
      "#4a6741",
    ),
    default_width_m: 4,
    rate_card_sku: "PLT-HORN",
  },
  {
    id: "lomandra-mass",
    label: "Lomandra mass",
    category: "planting",
    description: "Mass-planted strappy understorey",
    keywords: ["grass", "native", "understorey"],
    path_d: "M6 18c0-4 2-8 6-8s6 4 6 8",
    asset: G(
      [
        { d: "M4 38c4-10 8-14 20-14s16 4 20 14", fill: "#6b8f5e", opacity: 0.35 },
        { d: "M10 38V22c0-4 2-6 4-6s4 2 4 6v16", fill: "#7da86c", stroke: "#4a6741", stroke_width: 0.8 },
        { d: "M22 38V20c0-5 3-8 6-8s6 3 6 8v18", fill: "#8fbc7a", stroke: "#4a6741", stroke_width: 0.8 },
        { d: "M34 38V24c0-3 2-5 4-5s4 2 4 5v14", fill: "#7da86c", stroke: "#4a6741", stroke_width: 0.8 },
      ],
      "#edf5ea",
      "#6b8f5e",
    ),
    default_width_m: 2,
  },
  {
    id: "agapanthus-drift",
    label: "Agapanthus drift",
    category: "planting",
    description: "Blue/white drift along paths",
    keywords: ["perennial", "border"],
    path_d: "M12 8a4 4 0 100 8 4 4 0 000-8M28 10a3 3 0 110 6",
    asset: G(
      [
        { d: "M8 40V28c0-6 4-10 8-10s8 4 8 10v12", fill: "#5a8a4a", stroke: "#3d6234", stroke_width: 0.8 },
        { d: "M12 18a5 5 0 110 10 5 5 0 010-10", fill: "#7eb8e8" },
        { d: "M28 40V30c0-5 3-8 6-8s6 3 6 8v10", fill: "#5a8a4a", stroke: "#3d6234", stroke_width: 0.8 },
        { d: "M30 20a4 4 0 110 8 4 4 0 010-8", fill: "#9ecae8" },
      ],
      "#e8f4fc",
      "#7eb8e8",
    ),
  },
  {
    id: "box-ball",
    label: "Buxus sphere",
    category: "planting",
    description: "Formal clipped sphere",
    keywords: ["topiary", "evergreen"],
    path_d: "M12 12a8 8 0 1016 0 8 8 0 00-16 0",
    asset: G(
      [
        { d: "M24 38V32", stroke: "#5c4a32", stroke_width: 2 },
        { d: "M12 22a12 12 0 1024 0 12 12 0 00-24 0", fill: "#3d6b3a", stroke: "#2a4d28", stroke_width: 1 },
        { d: "M16 18a6 6 0 0012 0", fill: "#5c8f55", opacity: 0.5 },
      ],
      "#e6efe5",
      "#3d6b3a",
    ),
  },
  {
    id: "olive-standard",
    label: "Olive standard",
    category: "planting",
    description: "Single-trunk olive lollipop",
    keywords: ["mediterranean", "tree"],
    path_d: "M12 20V8M12 8a6 6 0 1012 0",
    asset: G(
      [
        { d: "M24 40V22", stroke: "#6b5344", stroke_width: 2.5 },
        { d: "M10 14a14 10 0 1028 0 14 10 0 00-28 0", fill: "#7a8f5c", stroke: "#556b42", stroke_width: 1 },
        { d: "M14 12a8 5 0 0016 0", fill: "#9aaa72", opacity: 0.45 },
      ],
      "#f4f2e8",
      "#7a8f5c",
    ),
  },
  {
    id: "liriope-edge",
    label: "Liriope edge",
    category: "planting",
    description: "Strappy border edging",
    keywords: ["edge", "shade"],
    path_d: "M4 20h16M6 16v8M10 14v10M14 16v8",
    asset: G(
      [
        { d: "M4 36h32", stroke: "#8a7a5c", stroke_width: 1, opacity: 0.4 },
        { d: "M8 36V20M12 36V18M16 36V22M20 36V19M24 36V21M28 36V18M32 36V20", stroke: "#5a7a48", stroke_width: 2.5 },
        { d: "M6 14h28", fill: "#6b8f5e", opacity: 0.25 },
      ],
      "#eef4ea",
      "#5a7a48",
    ),
  },
  {
    id: "lawn-turf",
    label: "Turf lawn",
    category: "planting",
    description: "Fine turf area",
    keywords: ["grass", "lawn"],
    path_d: "M4 8h16v12H4z",
    asset: G(
      [
        { d: "M6 10h28v26H6z", fill: "#7cb86a", stroke: "#5a9a48", stroke_width: 1 },
        { d: "M8 14h24M8 20h24M8 26h20", stroke: "#8fd078", stroke_width: 0.8, opacity: 0.6 },
      ],
      "#e5f5df",
      "#7cb86a",
    ),
  },

  /* —— Hardscape / paving —— */
  {
    id: "bluestone-paver",
    label: "Bluestone paver",
    category: "paving",
    description: "Honed bluestone — Curtis default paving",
    keywords: ["stone", "patio", "path"],
    path_d: "M3 3h18v18H3z M3 12h18 M12 3v18",
    asset: G(
      [
        { d: "M6 8h14v14H6z", fill: "#5a6578", stroke: "#3d4554", stroke_width: 1 },
        { d: "M6 15h14M13 8v14", stroke: "#7a8699", stroke_width: 0.8 },
        { d: "M8 10h4v4H8z M16 18h4v4h-4z", fill: "#6d7a8f", opacity: 0.5 },
      ],
      "#e8ebf0",
      "#5a6578",
    ),
    default_width_m: 0.6,
    rate_card_sku: "PAV-BLUE",
  },
  {
    id: "granite-stepper",
    label: "Granite steppers",
    category: "paving",
    description: "Stepping stone path",
    keywords: ["path", "granite"],
    path_d: "M4 16h6v4H4zm10-6h6v4h-6z",
    asset: G(
      [
        { d: "M6 28h10v8H6z", fill: "#8a9098", stroke: "#5c636b", stroke_width: 1 },
        { d: "M20 18h11v7H20z", fill: "#9aa0a8", stroke: "#5c636b", stroke_width: 1 },
        { d: "M10 10h9v6H10z", fill: "#7a828a", stroke: "#5c636b", stroke_width: 1 },
        { d: "M4 36h32", stroke: "#b8a88a", stroke_width: 1, opacity: 0.5 },
      ],
      "#f0eeea",
      "#8a9098",
    ),
    default_width_m: 0.5,
  },
  {
    id: "sandstone-crazy",
    label: "Crazy-pave sandstone",
    category: "paving",
    description: "Organic sandstone paving",
    keywords: ["sandstone", "terrace"],
    path_d: "M3 6l6 4 4-3 8 5 4-6 6 8",
    asset: G(
      [
        { d: "M5 12l8 5 6-4 10 7 4-8 8 10H5z", fill: "#c4a574", stroke: "#9a7a4a", stroke_width: 1 },
        { d: "M10 16l5 3 4-5", stroke: "#d4b88a", stroke_width: 0.8 },
        { d: "M22 22l6 4 3-6", stroke: "#b89868", stroke_width: 0.8 },
      ],
      "#faf4e8",
      "#c4a574",
    ),
  },
  {
    id: "basalt-grid",
    label: "Basalt grid paving",
    category: "paving",
    description: "Dark honed basalt grid",
    keywords: ["basalt", "modern"],
    path_d: "M4 4h16v16H4zM10 4v16M4 10h16",
    asset: G(
      [
        { d: "M8 10h24v24H8z", fill: "#3a3d42", stroke: "#25272b", stroke_width: 1 },
        { d: "M20 10v24M8 22h24", stroke: "#52565e", stroke_width: 0.9 },
      ],
      "#e8e8ea",
      "#3a3d42",
    ),
  },
  {
    id: "gravel-mulch",
    label: "Gravel mulch",
    category: "paving",
    description: "Compacted gravel / mulch bed",
    keywords: ["gravel", "drainage"],
    path_d: "M4 14h16M6 10h12M8 18h8",
    asset: G(
      [
        { d: "M6 12h28v22H6z", fill: "#a89888", stroke: "#7a6a5a", stroke_width: 1 },
        { d: "M10 16h3v2h-3zm6 4h2v2h-2zm8 2h3v2h-3zm4 8h2v2h-2z", fill: "#8a7a6a", opacity: 0.7 },
      ],
      "#f2ebe4",
      "#a89888",
    ),
  },
  {
    id: "timber-deck",
    label: "Timber deck",
    category: "paving",
    description: "Spotted gum deck boards",
    keywords: ["deck", "timber"],
    path_d: "M3 6h18v3H3zm0 5h18v3H3z",
    asset: G(
      [
        { d: "M6 10h28v24H6z", fill: "#8b6914", stroke: "#5c4610", stroke_width: 1 },
        { d: "M6 14h28M6 18h28M6 22h28M6 26h28M6 30h28", stroke: "#6b5010", stroke_width: 0.7 },
      ],
      "#f5ead8",
      "#8b6914",
    ),
  },

  /* —— Structures —— */
  {
    id: "pergola",
    label: "Timber pergola",
    category: "structure",
    description: "Overhead timber pergola",
    keywords: ["shade", "timber"],
    path_d: "M4 20V8h16v12M4 8l8-4 8 4",
    asset: G(
      [
        { d: "M8 38V16h4v22M28 38V16h4v22M36 38V16h4v22", fill: "#6b5010", stroke: "#4a3810", stroke_width: 0.8 },
        { d: "M6 14h32M6 20h32", stroke: "#8b6914", stroke_width: 3 },
        { d: "M6 10 L24 4 38 10", stroke: "#7a5c12", stroke_width: 2, fill: "none" },
      ],
      "#f8f0e4",
      "#8b6914",
    ),
    default_width_m: 3,
  },
  {
    id: "retaining-wall",
    label: "Retaining wall",
    category: "structure",
    description: "Stone/block retaining",
    keywords: ["wall", "level"],
    path_d: "M3 14h18v6H3z",
    asset: G(
      [
        { d: "M6 20h28v16H6z", fill: "#7a7a82", stroke: "#52525a", stroke_width: 1 },
        { d: "M6 24h28M6 28h28M6 32h28", stroke: "#5a5a62", stroke_width: 0.8 },
        { d: "M4 18 L32 12", fill: "#8fbc8f", opacity: 0.35 },
      ],
      "#ececef",
      "#7a7a82",
    ),
  },
  {
    id: "pool",
    label: "Pool",
    category: "water",
    description: "Pool shell outline",
    keywords: ["swim", "water"],
    path_d: "M4 12a8 8 0 1016 0 8 8 0 00-16 0",
    asset: G(
      [
        { d: "M10 14a14 10 0 1028 0 14 10 0 00-28 0", fill: "#4a9ec4", stroke: "#2a7a9a", stroke_width: 1.2 },
        { d: "M14 16a8 5 0 0016 0", fill: "#7ec8e8", opacity: 0.55 },
        { d: "M12 12h4v2h-4z", fill: "#ffffff", opacity: 0.4 },
      ],
      "#e0f4fc",
      "#4a9ec4",
    ),
    default_width_m: 4,
  },
  {
    id: "spa-plunge",
    label: "Plunge spa",
    category: "water",
    description: "Compact plunge / spa",
    keywords: ["spa", "heated"],
    path_d: "M6 10h12v10H6z",
    asset: G(
      [
        { d: "M14 12h16v18H14z", fill: "#3a8aaa", stroke: "#2a6a82", stroke_width: 1 },
        { d: "M18 16h8v8h-8z", fill: "#6ec0e0", opacity: 0.6 },
      ],
      "#dceef8",
      "#3a8aaa",
    ),
  },
  {
    id: "seat-wall",
    label: "Seat wall",
    category: "furniture",
    description: "Stone seat wall",
    keywords: ["seat", "wall"],
    path_d: "M3 14h18v4H3z",
    asset: G(
      [
        { d: "M8 22h28v12H8z", fill: "#8a8580", stroke: "#5a5550", stroke_width: 1 },
        { d: "M8 26h28", stroke: "#6a6560", stroke_width: 0.8 },
        { d: "M10 18h24v4H10z", fill: "#9a9590", stroke: "#6a6560", stroke_width: 0.8 },
      ],
      "#f0eeec",
      "#8a8580",
    ),
    default_width_m: 2,
  },
  {
    id: "fire-pit",
    label: "Fire pit",
    category: "furniture",
    description: "Entertainment fire pit",
    keywords: ["fire", "entertain"],
    path_d: "M8 12a4 4 0 108 0M12 8v8",
    asset: G(
      [
        { d: "M14 20h16v8H14z", fill: "#6a6560", stroke: "#4a4540", stroke_width: 1 },
        { d: "M18 14a8 8 0 1016 0 8 8 0 00-16 0", fill: "#4a4540", stroke: "#2a2520", stroke_width: 1 },
        { d: "M22 16a4 4 0 008 0", fill: "#e87840", opacity: 0.7 },
      ],
      "#f5f0ec",
      "#e87840",
    ),
  },
  {
    id: "dim-line",
    label: "Dimension",
    category: "annotation",
    description: "Dimension line",
    keywords: ["measure", "dim"],
    path_d: "M3 12h18M3 10v4M21 10v4",
    asset: G(
      [
        { d: "M8 24h28", stroke: "#ff2ef6", stroke_width: 1.5 },
        { d: "M8 20v8M34 20v8", stroke: "#ff2ef6", stroke_width: 1.5 },
      ],
      "#fdf0fc",
      "#ff2ef6",
    ),
  },
  {
    id: "existing-tree-retain",
    label: "Existing tree (retain)",
    category: "planting",
    description: "Retain — TPZ / SRP per arborist (AS 4970)",
    keywords: ["TRP", "arborist", "canopy"],
    path_d: "M12 8a8 8 0 1016 0 8 8 0 00-16 0M12 6v16",
    asset: G(
      [
        { d: "M24 38V20", stroke: "#5c4a32", stroke_width: 2.5 },
        { d: "M10 14a14 10 0 1028 0 14 10 0 00-28 0", fill: "#3d6b3a", stroke: "#2a4d28", stroke_width: 1 },
        { d: "M14 10 L34 6", stroke: "#c410a8", stroke_width: 1.5, opacity: 0.8 },
      ],
      "#e8f5e8",
      "#3d6b3a",
    ),
  },
  {
    id: "tree-root-protection",
    label: "Tree protection zone",
    category: "annotation",
    description: "TRP fence / TPZ — no dig without arborist sign-off",
    keywords: ["TRP", "TPZ", "AS4970", "fence"],
    path_d: "M4 12h16M4 8v8M20 8v8",
    asset: G(
      [
        { d: "M6 14h28v18H6z", fill: "none", stroke: "#c410a8", stroke_width: 1.2, opacity: 0.5 },
        { d: "M8 10h24v4H8z", fill: "#ff2ef6", opacity: 0.25 },
        { d: "M10 8v6M18 8v6M26 8v6", stroke: "#c410a8", stroke_width: 1 },
      ],
      "#fdf0fc",
      "#ff2ef6",
    ),
  },
  {
    id: "north",
    label: "North",
    category: "annotation",
    description: "North point",
    keywords: ["north", "arrow"],
    path_d: "M12 4v16M12 4l-4 6h8z",
    asset: G(
      [
        { d: "M24 8v24M24 8l-6 10h12z", fill: "#ff2ef6", stroke: "#c410a8", stroke_width: 0.8 },
        { d: "M22 34h4", stroke: "#888", stroke_width: 1.5 },
      ],
      "#fdf0fc",
      "#ff2ef6",
    ),
  },
];

export const CATALOG_CATEGORY_ORDER: CatalogCategory[] = [
  "planting",
  "paving",
  "structure",
  "water",
  "furniture",
  "annotation",
];

export function filterCatalogSymbols(
  symbols: CatalogSymbol[],
  opts: { category?: CatalogCategory | "all"; query?: string },
): CatalogSymbol[] {
  const q = opts.query?.trim().toLowerCase() ?? "";
  return symbols.filter((sym) => {
    if (opts.category && opts.category !== "all" && sym.category !== opts.category) {
      return false;
    }
    if (!q) return true;
    const hay = [
      sym.label,
      sym.description ?? "",
      ...(sym.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

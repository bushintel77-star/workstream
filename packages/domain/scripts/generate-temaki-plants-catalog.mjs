/**
 * Temaki CC0 plant / shrub / groundcover SVGs → CatalogSymbol[].
 * Run: node packages/domain/scripts/generate-temaki-plants-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domainRoot = path.resolve(__dirname, "..");
const iconsRoot = path.join(domainRoot, "assets", "temaki-plants");

const META = {
  garden_bed: {
    label: "Garden bed",
    keywords: ["bed", "planting", "shrub", "groundcover"],
    width: 3,
  },
  grass: {
    label: "Ornamental grass",
    keywords: ["grass", "groundcover", "strappy"],
    width: 1.2,
  },
  hedge: {
    label: "Hedge",
    keywords: ["hedge", "screen", "shrub"],
    width: 4,
  },
  island_trees_building: {
    label: "Tree island",
    keywords: ["tree", "island", "canopy"],
    width: 8,
  },
  islet_tree: {
    label: "Islet tree",
    keywords: ["tree", "specimen"],
    width: 5,
  },
  lawn: {
    label: "Lawn",
    keywords: ["lawn", "turf", "groundcover"],
    width: 6,
  },
  plant: {
    label: "Plant",
    keywords: ["plant", "perennial", "small"],
    width: 1,
  },
  shrub: {
    label: "Shrub",
    keywords: ["shrub", "bush"],
    width: 2.2,
  },
  shrub_low: {
    label: "Low shrub",
    keywords: ["shrub", "groundcover", "low"],
    width: 1.5,
  },
  tree_and_bench: {
    label: "Tree and bench",
    keywords: ["tree", "furniture"],
    width: 5,
  },
  tree_broadleaved: {
    label: "Broadleaved tree",
    keywords: ["tree", "deciduous"],
    width: 7,
  },
  tree_cactus: {
    label: "Cactus",
    keywords: ["succulent", "arid"],
    width: 1.5,
  },
  tree_leafless: {
    label: "Leafless tree",
    keywords: ["tree", "winter", "deciduous"],
    width: 6,
  },
  tree_needleleaved: {
    label: "Needleleaved tree",
    keywords: ["tree", "conifer"],
    width: 5,
  },
  tree_palm: {
    label: "Palm",
    keywords: ["palm", "tree"],
    width: 5,
  },
  tree_row: {
    label: "Tree row",
    keywords: ["avenue", "row", "tree"],
    width: 10,
  },
  tree_stump: {
    label: "Tree stump",
    keywords: ["stump", "existing"],
    width: 1.2,
  },
};

function parseStyleFills(svg) {
  const map = new Map();
  const re = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*fill:\s*([^;}\s]+)/g;
  let m;
  while ((m = re.exec(svg)) !== null) map.set(m[1], m[2]);
  return map;
}

function parseLayers(svg, fills) {
  const layers = [];
  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m;
  while ((m = pathRe.exec(svg)) !== null) {
    const attrs = m[1];
    const dM = attrs.match(/\bd="([^"]+)"/i);
    if (!dM) continue;
    const classM = attrs.match(/\bclass="([^"]+)"/i);
    const styleM = attrs.match(/\bstyle="([^"]+)"/i);
    const fillAttr = attrs.match(/\bfill="([^"]+)"/i);
    const inlineFill =
      fillAttr?.[1] ??
      styleM?.[1]?.match(/fill:\s*([^;"]+)/i)?.[1];
    const cls = classM?.[1]?.trim().split(/\s+/)[0];
    let fill = inlineFill ?? (cls ? fills.get(cls) : undefined);
    if (fill === "#000000" || fill === "#000") fill = "#4a6741";
    if (!fill || fill === "none") fill = "#4a6741";
    layers.push({ d: dM[1], fill });
  }
  return layers.slice(0, 10);
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  return m ? m[1] : "0 0 15 15";
}

if (!fs.existsSync(iconsRoot)) {
  throw new Error("Run download-temaki-plants.mjs first.");
}

const symbols = [];
for (const file of fs.readdirSync(iconsRoot).filter((f) => f.endsWith(".svg")).sort()) {
  const slug = file.replace(/\.svg$/, "");
  const meta = META[slug] ?? {
    label: slug.replace(/_/g, " "),
    keywords: ["plant"],
    width: 2,
  };
  const svg = fs.readFileSync(path.join(iconsRoot, file), "utf8");
  const layers = parseLayers(svg, parseStyleFills(svg));
  if (layers.length === 0) {
    console.log(`skip (no paths): ${file}`);
    continue;
  }
  symbols.push({
    id: `temaki-${slug.replace(/_/g, "-")}`,
    label: meta.label,
    category: "planting",
    description:
      "Temaki map icons (CC0-1.0) — rapideditor/temaki, shrubs / groundcover / trees",
    keywords: [
      ...meta.keywords,
      "temaki",
      "cc0",
      "landscape",
      "planting",
      "ai cad",
      "design library",
      "shrub",
      "groundcover",
    ],
    path_d: layers[0].d,
    default_width_m: meta.width,
    asset: {
      view_box: parseViewBox(svg),
      layers,
      preview_bg: "#edf5ea",
      accent: "#5a7a48",
    },
  });
}

const outPath = path.join(domainRoot, "src", "temaki-plant-symbols.ts");
fs.writeFileSync(
  outPath,
  `/** AUTO-GENERATED — Temaki CC0 plant icons. Regenerate: pnpm import:temaki-plants */
import type { CatalogSymbol } from "@workstream/contracts";

export const TEMAKI_PLANT_ATTRIBUTION =
  "Temaki icons (CC0-1.0) — https://github.com/rapideditor/temaki";

/** ${symbols.length} planting glyphs from Temaki (shrubs, groundcover, trees). */
export const TEMAKI_PLANT_SYMBOLS: CatalogSymbol[] = ${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];
`,
  "utf8",
);
console.log(`Wrote ${symbols.length} symbols → ${outPath}`);

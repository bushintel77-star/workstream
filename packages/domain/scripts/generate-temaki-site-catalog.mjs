/**
 * Temaki CC0 hardscape / lighting / site furniture SVGs → CatalogSymbol[].
 * Run: node packages/domain/scripts/generate-temaki-site-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domainRoot = path.resolve(__dirname, "..");
const iconsRoot = path.join(domainRoot, "assets", "temaki-site");

const META = {
  bench: {
    label: "Bench",
    category: "furniture",
    keywords: ["seat", "furniture"],
    width: 1.8,
  },
  bollard: {
    label: "Bollard",
    category: "structure",
    keywords: ["bollard", "barrier"],
    width: 0.4,
  },
  bollard_row: {
    label: "Bollard row",
    category: "structure",
    keywords: ["bollard", "barrier"],
    width: 3,
  },
  bridge: {
    label: "Bridge",
    category: "structure",
    keywords: ["bridge", "crossing"],
    width: 4,
  },
  campfire: {
    label: "Campfire",
    category: "furniture",
    keywords: ["fire", "entertain"],
    width: 1.2,
  },
  fireplace: {
    label: "Fireplace",
    category: "furniture",
    keywords: ["fire", "hearth"],
    width: 1.6,
  },
  fountain: {
    label: "Fountain",
    category: "water",
    keywords: ["fountain", "water"],
    width: 2,
  },
  gate: {
    label: "Gate",
    category: "structure",
    keywords: ["gate", "access"],
    width: 1.5,
  },
  guard_rail: {
    label: "Guard rail",
    category: "structure",
    keywords: ["rail", "barrier", "safety"],
    width: 3,
  },
  "kerb-flush": {
    label: "Kerb flush",
    category: "paving",
    keywords: ["kerb", "edge", "hardscape"],
    width: 0.3,
  },
  "kerb-lowered": {
    label: "Kerb lowered",
    category: "paving",
    keywords: ["kerb", "access", "hardscape"],
    width: 0.3,
  },
  "kerb-raised": {
    label: "Kerb raised",
    category: "paving",
    keywords: ["kerb", "edge", "hardscape"],
    width: 0.3,
  },
  "kerb-rolled": {
    label: "Kerb rolled",
    category: "paving",
    keywords: ["kerb", "edge", "hardscape"],
    width: 0.3,
  },
  mast_lighting: {
    label: "Mast light",
    category: "lighting",
    keywords: ["light", "mast", "pole", "lighting"],
    width: 0.8,
  },
  picnic_shelter: {
    label: "Picnic shelter",
    category: "structure",
    keywords: ["shelter", "shade"],
    width: 4,
  },
  railing: {
    label: "Railing",
    category: "structure",
    keywords: ["rail", "balustrade"],
    width: 2.5,
  },
  rope_fence: {
    label: "Rope fence",
    category: "structure",
    keywords: ["fence", "barrier"],
    width: 3,
  },
  sculpture: {
    label: "Sculpture",
    category: "furniture",
    keywords: ["art", "feature"],
    width: 1.5,
  },
  spa: {
    label: "Spa",
    category: "water",
    keywords: ["spa", "plunge"],
    width: 2.2,
  },
  speed_table: {
    label: "Speed table",
    category: "paving",
    keywords: ["crossing", "raised", "hardscape"],
    width: 3,
  },
  street_lamp_arm: {
    label: "Street lamp",
    category: "lighting",
    keywords: ["light", "lamp", "path", "lighting"],
    width: 0.6,
  },
  tall_gate: {
    label: "Tall gate",
    category: "structure",
    keywords: ["gate", "privacy"],
    width: 2,
  },
  utility_pole: {
    label: "Utility pole",
    category: "structure",
    keywords: ["pole", "service"],
    width: 0.5,
  },
  wall: {
    label: "Wall",
    category: "structure",
    keywords: ["wall", "boundary", "hardscape"],
    width: 0.4,
  },
  waste: {
    label: "Waste bin",
    category: "furniture",
    keywords: ["bin", "waste"],
    width: 0.6,
  },
};

function parseStyleFills(svg) {
  const map = new Map();
  const re = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*fill:\s*([^;}\s]+)/g;
  let m;
  while ((m = re.exec(svg)) !== null) map.set(m[1], m[2]);
  return map;
}

function defaultFill(category) {
  if (category === "lighting") return "#c9a227";
  if (category === "water") return "#4a9ec4";
  if (category === "paving") return "#7a7a82";
  if (category === "furniture") return "#6b5010";
  return "#5a6578";
}

function parseLayers(svg, fills, category) {
  const accent = defaultFill(category);
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
    if (fill === "#000000" || fill === "#000") fill = accent;
    if (!fill || fill === "none") fill = accent;
    layers.push({ d: dM[1], fill });
  }
  return layers.slice(0, 10);
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  return m ? m[1] : "0 0 15 15";
}

function previewBg(category) {
  if (category === "lighting") return "#faf6e8";
  if (category === "water") return "#e0f4fc";
  if (category === "paving") return "#ececef";
  return "#f0eeec";
}

if (!fs.existsSync(iconsRoot)) {
  throw new Error("Run download-temaki-site.mjs first.");
}

const symbols = [];
for (const file of fs.readdirSync(iconsRoot).filter((f) => f.endsWith(".svg")).sort()) {
  const slug = file.replace(/\.svg$/, "");
  const meta = META[slug] ?? {
    label: slug.replace(/_/g, " ").replace(/-/g, " "),
    category: "structure",
    keywords: ["hardscape"],
    width: 1.5,
  };
  const svg = fs.readFileSync(path.join(iconsRoot, file), "utf8");
  const layers = parseLayers(svg, parseStyleFills(svg), meta.category);
  if (layers.length === 0) {
    console.log(`skip (no paths): ${file}`);
    continue;
  }
  symbols.push({
    id: `temaki-${slug.replace(/_/g, "-")}`,
    label: meta.label,
    category: meta.category,
    description:
      "Temaki map icons (CC0-1.0) — rapideditor/temaki, hardscape / lighting / furniture",
    keywords: [
      ...meta.keywords,
      "temaki",
      "cc0",
      "hardscape",
      "ai cad",
      "design library",
    ],
    path_d: layers[0].d,
    default_width_m: meta.width,
    asset: {
      view_box: parseViewBox(svg),
      layers,
      preview_bg: previewBg(meta.category),
      accent: defaultFill(meta.category),
    },
  });
}

const outPath = path.join(domainRoot, "src", "temaki-site-symbols.ts");
fs.writeFileSync(
  outPath,
  `/** AUTO-GENERATED — Temaki CC0 hardscape / lighting icons. Regenerate: pnpm import:temaki-site */
import type { CatalogSymbol } from "@workstream/contracts";

export const TEMAKI_SITE_ATTRIBUTION =
  "Temaki icons (CC0-1.0) — https://github.com/rapideditor/temaki";

/** ${symbols.length} hardscape / lighting / furniture glyphs from Temaki. */
export const TEMAKI_SITE_SYMBOLS: CatalogSymbol[] = ${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];
`,
  "utf8",
);
console.log(`Wrote ${symbols.length} symbols → ${outPath}`);

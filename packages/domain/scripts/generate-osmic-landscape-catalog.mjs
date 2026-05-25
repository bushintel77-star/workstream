/**
 * Osmic CC0 map icons → landscaping CatalogSymbol[] (trees, site furniture, water, gates).
 * Run: node packages/domain/scripts/generate-osmic-landscape-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domainRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(domainRoot, "../..");

const INCLUDE = [
  /^nature\//,
  /^outdoor\/(bench|table|fountain|drinking-water|shelter|guidepost|camping)-/,
  /^amenity\/playground-/,
  /^sports\/swimming-/,
  /^barrier\/(gate|steps|bollard|lift-gate|cattle-grid)-/,
  /^shop\/(garden-centre|florist)-/,
  /^tourism\/viewpoint-/,
];

const CATEGORY_RULES = [
  [/tree|florist|garden-centre/, "planting"],
  [/fountain|waterfall|spring|swimming|drinking-water/, "water"],
  [/bench|table|playground|camping/, "furniture"],
  [/gate|bollard|lift-gate|cattle-grid|shelter|viewpoint/, "structure"],
  [/steps/, "paving"],
  [/peak|saddle/, "annotation"],
];

function findOsmicRoot() {
  const pnpm = path.join(repoRoot, "node_modules", ".pnpm");
  const entry = fs.readdirSync(pnpm).find((n) => n.startsWith("osmic@"));
  if (!entry) throw new Error("Run pnpm install (osmic-source devDependency).");
  return path.join(pnpm, entry, "node_modules", "osmic");
}

function titleFromFile(file) {
  const base = file.replace(/-\d+\.svg$/, "").replace(/-/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    const inlineFillM = attrs.match(/\bfill:\s*([^;"]+)/i) ?? styleM?.[1]?.match(/fill:\s*([^;"]+)/i);
    const cls = classM?.[1]?.trim().split(/\s+/)[0];
    let fill = inlineFillM?.[1] ?? (cls ? fills.get(cls) : undefined);
    if (fill === "#000000" || fill === "#000") fill = "#4a6741";
    if (!fill || fill === "none") fill = "#4a6741";
    layers.push({ d: dM[1], fill });
  }
  return layers.slice(0, 8);
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  return m ? m[1] : "0 0 14 14";
}

function categoryFor(relPath) {
  const key = relPath.replace(/-\d+\.svg$/, "");
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(key)) return cat;
  }
  return "planting";
}

const iconsRoot = findOsmicRoot();
const all = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) walk(fp);
    else if (f.name.endsWith(".svg")) all.push(path.relative(iconsRoot, fp).split(path.sep).join("/"));
  }
}
walk(iconsRoot);

const byBase = new Map();
for (const rel of all) {
  if (!INCLUDE.some((re) => re.test(rel))) continue;
  const base = rel.replace(/-\d+\.svg$/, "");
  const size = rel.match(/-(\d+)\.svg$/)?.[1] ?? "0";
  const prev = byBase.get(base);
  if (!prev || Number(size) > Number(prev.size)) byBase.set(base, { rel, size });
}

const symbols = [];
for (const [base, { rel }] of [...byBase.entries()].sort()) {
  const svg = fs.readFileSync(path.join(iconsRoot, rel), "utf8");
  const layers = parseLayers(svg, parseStyleFills(svg));
  if (layers.length === 0) continue;
  const slug = base.replace(/\//g, "-");
  symbols.push({
    id: `osmic-${slug}`,
    label: titleFromFile(path.basename(rel)),
    category: categoryFor(rel),
    description: "Osmic map icons (CC0) — gmgeo/osmic, landscaping",
    keywords: [slug, "landscape", "osmic", "cc0", categoryFor(rel)],
    path_d: layers[0].d,
    asset: {
      view_box: parseViewBox(svg),
      layers,
      preview_bg: "#edf5ea",
      accent: "#5a7a48",
    },
  });
}

const outPath = path.join(domainRoot, "src", "osmic-landscape-symbols.ts");
fs.writeFileSync(
  outPath,
  `/** AUTO-GENERATED — Osmic CC0 landscaping icons. Regenerate: node packages/domain/scripts/generate-osmic-landscape-catalog.mjs */
import type { CatalogSymbol } from "@workstream/contracts";

/** ${symbols.length} landscaping glyphs from https://github.com/gmgeo/osmic */
export const OSMIC_LANDSCAPE_SYMBOLS: CatalogSymbol[] = ${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];
`,
  "utf8",
);
console.log(`Wrote ${symbols.length} symbols → ${outPath}`);

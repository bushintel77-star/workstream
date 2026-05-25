/**
 * One-shot generator: Open Crop Icons (CC0) → CatalogSymbol[].
 * Run from repo root: node packages/domain/scripts/generate-open-crop-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domainRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(domainRoot, "../..");

function findIconsRoot() {
  const pnpm = path.join(repoRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpm)) throw new Error("Run pnpm install first (open-crop-icons).");
  const entry = fs.readdirSync(pnpm).find((n) => n.startsWith("open-crop-icons@"));
  if (!entry) throw new Error("open-crop-icons not installed.");
  return path.join(pnpm, entry, "node_modules", "open-crop-icons", "icons");
}

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseStyleFills(svg) {
  const map = new Map();
  const re = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*fill:\s*([^;}\s]+)/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function parsePaths(svg, fills) {
  const layers = [];
  const re = /<path\b([^>]*)\/?>/gi;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const dM = attrs.match(/\bd="([^"]+)"/i);
    if (!dM) continue;
    const d = dM[1];
    if (d.length < 4) continue;
    const classM = attrs.match(/\bclass="([^"]+)"/i);
    const inlineFillM = attrs.match(/\bfill="([^"]+)"/i);
    const cls = classM?.[1]?.trim().split(/\s+/)[0];
    let fill = inlineFillM?.[1] ?? (cls ? fills.get(cls) : undefined);
    if (!fill || fill === "none") fill = undefined;
    layers.push({
      d,
      fill: fill ?? undefined,
      stroke: fill ? undefined : "#4a6741",
      stroke_width: fill ? undefined : 0.8,
    });
  }
  return layers.slice(0, 12);
}

function pickSvgFile(dir, slug) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));
  const prefer =
    files.find((f) => f.includes("64")) ??
    files.find((f) => f === `${slug}.svg`) ??
    files[0];
  return prefer ? path.join(dir, prefer) : null;
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  if (m) return m[1];
  const w = svg.match(/\bwidth=["'](\d+)/i);
  const h = svg.match(/\bheight=["'](\d+)/i);
  if (w && h) return `0 0 ${w[1]} ${h[1]}`;
  return "0 0 64 64";
}

const iconsRoot = findIconsRoot();
const dirs = fs
  .readdirSync(iconsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const symbols = [];

for (const slug of dirs) {
  const dir = path.join(iconsRoot, slug);
  const svgPath = pickSvgFile(dir, slug);
  if (!svgPath) continue;
  const svg = fs.readFileSync(svgPath, "utf8");
  const fills = parseStyleFills(svg);
  const layers = parsePaths(svg, fills);
  if (layers.length === 0) continue;

  const viewBox = parseViewBox(svg);
  const path_d = layers[0].d;
  const id = `opencrop-${slug}`;

  symbols.push({
    id,
    label: titleCase(slug),
    category: "planting",
    description: "Open Crop Icons (CC0) — openfarmcc/open-crop-icons",
    keywords: [slug, "crop", "open crop", "cc0", "planting"],
    path_d,
    asset: {
      view_box: viewBox,
      layers,
      preview_bg: "#edf5ea",
      accent: "#5a7a48",
    },
  });
}

const outPath = path.join(domainRoot, "src", "open-crop-symbols.ts");
const header = `/** AUTO-GENERATED — Open Crop Icons (CC0). Regenerate: node packages/domain/scripts/generate-open-crop-catalog.mjs */
import type { CatalogSymbol } from "@workstream/contracts";

/** ${symbols.length} crop/plant glyphs from https://github.com/openfarmcc/open-crop-icons */
export const OPEN_CROP_SYMBOLS: CatalogSymbol[] = `;

fs.writeFileSync(
  outPath,
  `${header}${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];\n`,
  "utf8",
);

console.log(`Wrote ${symbols.length} symbols → ${outPath}`);

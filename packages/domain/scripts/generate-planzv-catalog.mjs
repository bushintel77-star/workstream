/**
 * PlanZV FNP CC0 SVGs ? CatalogSymbol[] for AI CAD / open-space design.
 * Run after download-planzv-fnp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domainRoot = path.resolve(__dirname, "..");
const svgDir = path.join(domainRoot, "assets", "planzv-fnp");

const LABELS = {
  Naturschutzgebiet: "Nature reserve",
  Wasser: "Water / utility",
  Parkanlage: "Park",
  Dauerkleingaerten: "Allotment gardens",
  Sportplatz: "Sports field",
  Badeplatz_Freibad: "Bathing / outdoor pool",
  Ueberschwemmungsgebiet: "Flood plain",
  Landschaftsschutzgebiet: "Landscape protection",
  Naturdenkmal: "Natural monument",
  Geschuetzter_Landschaftsbestandteil: "Protected landscape feature",
  begruenter_Stadtplatz: "Green urban square",
  Eigentuemergarten_Grabeland: "Private garden / allotment",
  Wassersportanlage: "Water sports",
  Flaechennaturdenkmal: "Natural monument (area)",
  Verkehrsbegleitgruen: "Roadside green",
  Erholungswald: "Recreation forest",
  Schutzspflanzung_Ortsrandeingruenung: "Shelter planting / edge green",
  Golfanlage_: "Golf course",
  FFH_Richtline: "Habitat directive (FFH)",
  Vogelschutzgebiet: "Bird sanctuary",
};

const CATEGORY = {
  Wasser: "water",
  Wassersportanlage: "water",
  Ueberschwemmungsgebiet: "water",
  Sportplatz: "furniture",
  Badeplatz_Freibad: "water",
  Golfanlage_: "furniture",
  Parkanlage: "planting",
  Dauerkleingaerten: "planting",
  Eigentuemergarten_Grabeland: "planting",
  begruenter_Stadtplatz: "planting",
  Verkehrsbegleitgruen: "planting",
  Erholungswald: "planting",
  Schutzspflanzung_Ortsrandeingruenung: "planting",
  Naturschutzgebiet: "annotation",
  Landschaftsschutzgebiet: "annotation",
  Naturdenkmal: "annotation",
  Geschuetzter_Landschaftsbestandteil: "annotation",
  Flaechennaturdenkmal: "annotation",
  FFH_Richtline: "annotation",
  Vogelschutzgebiet: "annotation",
};

const WIDTH_M = {
  Parkanlage: 12,
  Dauerkleingaerten: 8,
  Sportplatz: 20,
  Erholungswald: 16,
  Schutzspflanzung_Ortsrandeingruenung: 6,
  Verkehrsbegleitgruen: 4,
  begruenter_Stadtplatz: 10,
  Eigentuemergarten_Grabeland: 6,
  Wasser: 4,
  default: 5,
};

function parseStyleFills(svg) {
  const map = new Map();
  const re = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*fill:\s*([^;}\s]+)/g;
  let m;
  while ((m = re.exec(svg)) !== null) map.set(m[1], m[2]);
  return map;
}

function resolveFill(attrs, fills) {
  const classM = attrs.match(/\bclass="([^"]+)"/i);
  const styleM = attrs.match(/\bstyle="([^"]+)"/i);
  const fillAttr = attrs.match(/\bfill="([^"]+)"/i);
  const inlineFillM =
    fillAttr ??
    attrs.match(/\bfill:\s*([^;"]+)/i) ??
    styleM?.[1]?.match(/fill:\s*([^;"]+)/i);
  const classes = classM?.[1]?.trim().split(/\s+/) ?? [];
  let fill = inlineFillM?.[1];
  if (!fill) {
    for (const cls of classes) {
      if (fills.has(cls)) {
        fill = fills.get(cls);
        break;
      }
      // Corel class maps: fil1 ? fill from style block key fil1
      const hit = [...fills.entries()].find(([k]) => cls.includes(k));
      if (hit) {
        fill = hit[1];
        break;
      }
    }
  }
  if (classes.some((c) => c.startsWith("fil0") && fills.get("fil0") === "none")) {
    // stroke-only frame — skip unless we have stroke path later
  }
  if (!fill || fill === "none") return null;
  if (fill === "black" || fill === "#000" || fill === "#000000" || fill === "#2B2A29") {
    fill = "#4a6741";
  }
  return fill;
}

function parseLayers(svg, fills) {
  const layers = [];
  let m;

  const pathRe = /<path\b([^>]*)\/?>/gi;
  while ((m = pathRe.exec(svg)) !== null) {
    const attrs = m[1];
    const dM = attrs.match(/\bd="([^"]+)"/i);
    if (!dM) continue;
    const fill = resolveFill(attrs, fills) ?? "#4a6741";
    layers.push({ d: dM[1], fill });
  }

  const polyRe = /<(?:polygon|polyline)\b([^>]*)\/?>/gi;
  while ((m = polyRe.exec(svg)) !== null) {
    const attrs = m[1];
    const pts = attrs.match(/\bpoints="([^"]+)"/i);
    if (!pts) continue;
    const fill = resolveFill(attrs, fills) ?? "#5a7a48";
    const nums = pts[1].trim().split(/[\s,]+/).map(Number);
    if (nums.length < 6 || nums.some((n) => Number.isNaN(n))) continue;
    let d = `M${nums[0]} ${nums[1]}`;
    for (let i = 2; i < nums.length; i += 2) d += ` L${nums[i]} ${nums[i + 1]}`;
    d += " Z";
    layers.push({ d, fill });
  }

  const circleRe = /<circle\b([^>]*)\/?>/gi;
  while ((m = circleRe.exec(svg)) !== null) {
    const attrs = m[1];
    const fill = resolveFill(attrs, fills);
    if (!fill) continue;
    const cx = Number(attrs.match(/\bcx="([^"]+)"/i)?.[1]);
    const cy = Number(attrs.match(/\bcy="([^"]+)"/i)?.[1]);
    const r = Number(attrs.match(/\br="([^"]+)"/i)?.[1]);
    if (![cx, cy, r].every((n) => Number.isFinite(n)) || r <= 0) continue;
    // Circle as two-arc path
    const d = `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
    layers.push({ d, fill });
  }

  const rectRe = /<rect\b([^>]*)\/?>/gi;
  while ((m = rectRe.exec(svg)) !== null) {
    const attrs = m[1];
    const fill = resolveFill(attrs, fills);
    if (!fill) continue;
    const x = Number(attrs.match(/\bx="([^"]+)"/i)?.[1] ?? 0);
    const y = Number(attrs.match(/\by="([^"]+)"/i)?.[1] ?? 0);
    const w = Number(attrs.match(/\bwidth="([^"]+)"/i)?.[1]);
    const h = Number(attrs.match(/\bheight="([^"]+)"/i)?.[1]);
    if (![w, h].every((n) => Number.isFinite(n))) continue;
    layers.push({
      d: `M${x} ${y}h${w}v${h}h${-w}Z`,
      fill,
    });
  }

  return layers.slice(0, 12);
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  return m ? m[1] : "0 0 100 100";
}

function keyFromFile(file) {
  return file
    .replace(/^FNP_\d+_/, "")
    .replace(/\.svg$/i, "")
    .replace(/_+$/, "");
}

if (!fs.existsSync(svgDir)) {
  throw new Error("Missing assets/planzv-fnp — run download-planzv-fnp.mjs first");
}

const files = fs
  .readdirSync(svgDir)
  .filter((f) => f.endsWith(".svg"))
  .sort();

const symbols = [];
for (const file of files) {
  const key = keyFromFile(file);
  const svg = fs.readFileSync(path.join(svgDir, file), "utf8");
  const layers = parseLayers(svg, parseStyleFills(svg));
  if (layers.length === 0) {
    console.warn(`skip (no paths): ${file}`);
    continue;
  }
  const category = CATEGORY[key] ?? "annotation";
  const label = LABELS[key] ?? key.replace(/_/g, " ");
  const width = WIDTH_M[key] ?? WIDTH_M.default;
  const id = `planzv-${key.toLowerCase().replace(/_/g, "-")}`;
  symbols.push({
    id,
    label,
    category,
    description:
      "PlanZV FNP open-space symbol (CC0) — geoObserver/PlanZV-FNP — AI CAD design library",
    keywords: [
      "planzv",
      "ai cad",
      "design library",
      "cc0",
      "planning",
      category,
      key.toLowerCase().replace(/_/g, " "),
    ],
    path_d: layers[0].d,
    default_width_m: width,
    asset: {
      view_box: parseViewBox(svg),
      layers,
      preview_bg: "#edf5ea",
      accent: "#5a7a48",
    },
  });
}

const outPath = path.join(domainRoot, "src", "planzv-design-symbols.ts");
fs.writeFileSync(
  outPath,
  `/** AUTO-GENERATED — PlanZV FNP CC0 design symbols. Regenerate: pnpm import:planzv */
import type { CatalogSymbol } from "@workstream/contracts";

export const PLANZV_ATTRIBUTION =
  "PlanZV FNP symbols — Stadt Halle (Saale) / IT-Consult Halle (CC0 1.0). https://github.com/geoObserver/PlanZV-FNP";

/** ${symbols.length} open-space / AI CAD glyphs from PlanZV-FNP */
export const PLANZV_DESIGN_SYMBOLS: CatalogSymbol[] = ${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];
`,
  "utf8",
);
console.log(`Wrote ${symbols.length} symbols ? ${outPath}`);

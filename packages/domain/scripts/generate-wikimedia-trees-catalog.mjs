/**
 * Wikimedia "Set of trees" (CC BY-SA 4.0) → planting CatalogSymbol[].
 * Assets: packages/domain/assets/wikimedia-trees/tree-NN.svg
 * Run: node packages/domain/scripts/download-wikimedia-trees.mjs && node packages/domain/scripts/generate-wikimedia-trees-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, "../assets/wikimedia-trees");
const outPath = path.resolve(__dirname, "../src/wikimedia-tree-symbols.ts");

const ATTRIBUTION =
  "Heinrich Böll Foundation — Set of trees (CC BY-SA 4.0). https://commons.wikimedia.org/wiki/Category:SVG_trees";

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  if (m) return m[1];
  const w = svg.match(/\bwidth=["'](\d+)/i);
  const h = svg.match(/\bheight=["'](\d+)/i);
  if (w && h) return `0 0 ${w[1]} ${h[1]}`;
  return "0 0 320 400";
}

function parseGradientFills(svg) {
  const fills = new Map();
  const gradRe =
    /<(?:linear|radial)Gradient[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:linear|radial)Gradient>/gi;
  let m;
  while ((m = gradRe.exec(svg)) !== null) {
    const id = m[1];
    const body = m[2];
    const stop = body.match(/stop-color:\s*([^;}\s]+)/i);
    if (stop) fills.set(id, stop[1].trim());
  }
  return fills;
}

function resolveFill(raw, gradients) {
  if (!raw || raw === "none") return undefined;
  const urlM = raw.match(/url\(#([^)]+)\)/i);
  if (urlM) {
    const g = gradients.get(urlM[1]);
    if (g) return g;
    return "#4a6741";
  }
  if (raw.startsWith("#")) return raw;
  return raw;
}

/** Walk relative m/l/c/h/v/z paths (Commons tree set uses these). */
function pathEndpoints(d) {
  const tokens =
    d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cmd = "m";
  let x = 0;
  let y = 0;
  const pts = [];
  const read = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }
    switch (cmd) {
      case "M":
        x = read();
        y = read();
        pts.push([x, y]);
        cmd = "L";
        break;
      case "m":
        x += read();
        y += read();
        pts.push([x, y]);
        cmd = "l";
        break;
      case "L":
        x = read();
        y = read();
        pts.push([x, y]);
        break;
      case "l":
        x += read();
        y += read();
        pts.push([x, y]);
        break;
      case "H":
        x = read();
        pts.push([x, y]);
        break;
      case "h":
        x += read();
        pts.push([x, y]);
        break;
      case "V":
        y = read();
        pts.push([x, y]);
        break;
      case "v":
        y += read();
        pts.push([x, y]);
        break;
      case "C":
        read();
        read();
        read();
        read();
        x = read();
        y = read();
        pts.push([x, y]);
        break;
      case "c":
        read();
        read();
        read();
        read();
        x += read();
        y += read();
        pts.push([x, y]);
        break;
      case "Z":
      case "z":
        break;
      default:
        i++;
        break;
    }
  }
  return pts;
}

function rdp(points, epsilon) {
  if (points.length < 3) return points;
  const sq = (n) => n * n;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (sq(dx) + sq(dy));
    const projX = a[0] + t * dx;
    const projY = a[1] + t * dy;
    return Math.hypot(p[0] - projX, p[1] - projY);
  };
  const recurse = (start, end) => {
    let maxD = 0;
    let idx = 0;
    for (let i = start + 1; i < end; i++) {
      const d = dist(points[i], points[start], points[end]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon) {
      const left = recurse(start, idx);
      const right = recurse(idx, end);
      return left.slice(0, -1).concat(right);
    }
    return [points[start], points[end]];
  };
  return recurse(0, points.length - 1);
}

function pointsToPath(points) {
  if (points.length === 0) return "";
  const fmt = (n) => String(Math.round(n));
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i][0])} ${fmt(points[i][1])}`;
  }
  return `${d} Z`;
}

/** Studio glyphs are small — simplify traced Commons paths for bundle size. */
function simplifyPath(d, maxLen = 6000) {
  const pts = pathEndpoints(d);
  if (pts.length < 4) return d.length > maxLen ? d.slice(0, maxLen) : d;
  for (const eps of [2.5, 4, 6, 10, 16, 24, 36]) {
    const simple = rdp(pts, eps);
    const out = pointsToPath(simple);
    if (out.length <= maxLen) return out;
  }
  const coarse = rdp(pts, 48);
  return pointsToPath(coarse);
}

function parseLayers(svg) {
  const gradients = parseGradientFills(svg);
  const layers = [];

  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m;
  while ((m = pathRe.exec(svg)) !== null) {
    const attrs = m[1];
    const dM = attrs.match(/\bd="([^"]+)"/i);
    if (!dM || dM[1].length < 8) continue;
    const d = simplifyPath(dM[1]);
    const fillM =
      attrs.match(/\bfill="([^"]+)"/i) ??
      attrs.match(/\bfill:\s*([^;"]+)/i);
    const strokeM = attrs.match(/\bstroke="([^"]+)"/i);
    const fill = resolveFill(fillM?.[1], gradients);
    const stroke = strokeM?.[1];
    if (fill && fill !== "none") {
      layers.push({ d, fill });
    } else if (stroke && stroke !== "none") {
      layers.push({ d, stroke, stroke_width: 1.2 });
    } else {
      layers.push({ d, fill: "#4a6741" });
    }
  }

  return layers.slice(0, 4);
}

const files = fs
  .readdirSync(assetsDir)
  .filter((f) => /^tree-\d+\.svg$/i.test(f))
  .sort();

const symbols = [];

for (const file of files) {
  const num = file.match(/tree-(\d+)/)?.[1];
  if (!num) continue;
  const svg = fs.readFileSync(path.join(assetsDir, file), "utf8");
  const layers = parseLayers(svg);
  if (layers.length === 0) continue;

  symbols.push({
    id: `wikimedia-tree-${num}`,
    label: `Tree ${num}`,
    category: "planting",
    description: ATTRIBUTION,
    keywords: ["wikimedia", "tree", "landscape", "planting", `tree-${num}`, "ai cad", "design library"],
    path_d: layers[0].d,
    default_width_m: 6,
    asset: {
      view_box: parseViewBox(svg),
      layers,
      preview_bg: "#edf5ea",
      accent: "#5a7a48",
    },
  });
}

fs.writeFileSync(
  outPath,
  `/** AUTO-GENERATED — Wikimedia Set of trees (CC BY-SA 4.0). See docs/WIKIMEDIA-TREES.md */
import type { CatalogSymbol } from "@workstream/contracts";

export const WIKIMEDIA_TREE_ATTRIBUTION = ${JSON.stringify(ATTRIBUTION)};

/** ${symbols.length} landscape tree silhouettes from Wikimedia Commons */
export const WIKIMEDIA_TREE_SYMBOLS: CatalogSymbol[] = ${JSON.stringify(symbols, null, 2)} as CatalogSymbol[];
`,
  "utf8",
);

console.log(`Wrote ${symbols.length} symbols → ${outPath}`);

/**
 * CI gate: forbid raw hex colour literals in apps/web CSS/TSX outside
 * allowlist. Originally handoff-only; broadened to all of apps/web/src so
 * the "scrub hardcoded colour" pass on every page (not just the canvas
 * studio) stays enforced.
 *
 * Also enforces the "never darkness" law (TOKENS.md §1): scrim-strength
 * black overlays — rgba(0,0,0, α≥0.2) and color-mix(…, #000/black ≥20%) —
 * are forbidden outside the render-value allowlist, because raw hex checks
 * cannot see them (that is how the 40–50% black scrims slipped through in
 * the first place). Panels dim with neutral ink mixes
 * (color-mix(in srgb, var(--gs-ink-strong) N%)) and lift with the neutral
 * shadow tiers (--gs-shadow-1..4), never with black.
 *
 * Allowlist — deliberately small; every entry is a literal *data* colour
 * (paint choice / render value), never chrome identity:
 * - color-tokens.css, colorTokens.ts, globals.css (token source of truth)
 * - SVG mask algebra fff/000 in SelectionFocusVeil
 * - clientShareTwin.module.css: atmosphere swatch options are literal paint
 *   colours by definition (the swatch is the colour choice), not chrome
 * - ClientShareTwin.tsx: THREE.js scene/material colours (sky, ground,
 *   windows, sun-elevation gradient) — physical render values, not chrome
 * - comments containing hex
 * - APWA palette only inside colorTokens.ts (already source of truth)
 * - goldStandardStudio.module.css: token source of truth for the Gold
 *   Standard Studio Dark system (Growth Studio, Subsurface Studio) — same
 *   role as color-tokens.css/globals.css, just a second palette family
 *
 * All chrome (portal, quote, confirm-pin, share, siteCanvas, studio widgets)
 * is unified on one dark identity (--surface-deep) and one hero accent
 * (--accent) — see globals.css. No per-surface bespoke palettes.
 *
 * Usage: node scripts/check-handoff-chrome-colors.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = "apps/web/src";
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
// Scrim-strength blacks — alpha or mix percent at or above the threshold.
const SCRIM_BLACK_RGBA = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.(\d+)\s*\)/g;
const SCRIM_BLACK_MIX_HEX = /color-mix\(\s*in\s+srgb\s*,\s*#000(?:000)?\s+(\d+(?:\.\d+)?)%/g;
const SCRIM_BLACK_MIX_KEY = /\bcolor-mix\(\s*in\s+srgb\s*,\s*black\s+(\d+(?:\.\d+)?)%/g;
const SCRIM_ALPHA_MIN = 20; // 0.20

/** Paths (posix) that may contain literal hex. */
const ALLOW_PATH_SUBSTR = [
  // Mask algebra — not chrome paint
  "features/selectionFocus/SelectionFocusVeil.tsx",
  // Token source of truth
  "styles/color-tokens.css",
  "styles/colorTokens.ts",
  "styles/globals.css",
  // Literal colour-choice swatches / 3D render material colours (data, not chrome)
  "components/share/clientShareTwin.module.css",
  "components/share/ClientShareTwin.tsx",
  // Gold Standard Studio Dark token source of truth (Growth/Subsurface studios)
  "components/canvas/goldStandardStudio.module.css",
  // WebGL studio Three.js material/light colours — physical render values
  // (canopy foliage, trunk bark, APWA utility colours, boundary lines, grid),
  // not chrome identity. Same category as ClientShareTwin.tsx above.
  "components/canvas/webgl/",
];

/** Hex values permitted when they appear (mask / none). */
const ALLOW_HEX = new Set(["#fff", "#ffffff", "#000", "#000000"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(module\.css|css|tsx|ts)$/.test(ent.name) && !ent.name.endsWith(".test.ts"))
      out.push(p);
  }
  return out;
}

function stripComments(src, isCss) {
  if (isCss) {
    return src.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const files = walk(ROOT);
const violations = [];
const scrims = [];

for (const file of files) {
  const rel = file.replace(/\\/g, "/");
  if (ALLOW_PATH_SUBSTR.some((a) => rel.includes(a))) continue;

  const isCss = file.endsWith(".css");
  const raw = fs.readFileSync(file, "utf8");
  const src = stripComments(raw, isCss);

  const hits = src.match(HEX) ?? [];
  const bad = hits.filter((h) => !ALLOW_HEX.has(h.toLowerCase()));
  if (bad.length) {
    violations.push({
      file: rel,
      samples: [...new Set(bad)].slice(0, 10),
      count: bad.length,
    });
  }

  // "Never darkness" — scrim-strength black overlays (raw hex checks cannot
  // see these; the GS sweep found 40–50% black scrims this gate should have
  // caught). Alpha/mix ≥ 0.20 violates; neutral ink mixes are the lawful dim.
  const scrimSamples = [];
  for (const m of src.matchAll(SCRIM_BLACK_RGBA)) {
    if (parseInt(m[1], 10) >= SCRIM_ALPHA_MIN) scrimSamples.push(`rgba(0,0,0,0.${m[1]})`);
  }
  for (const m of src.matchAll(SCRIM_BLACK_MIX_HEX)) {
    if (parseFloat(m[1]) >= SCRIM_ALPHA_MIN) scrimSamples.push(`#000 ${m[1]}%`);
  }
  for (const m of src.matchAll(SCRIM_BLACK_MIX_KEY)) {
    if (parseFloat(m[1]) >= SCRIM_ALPHA_MIN) scrimSamples.push(`black ${m[1]}%`);
  }
  if (scrimSamples.length) {
    scrims.push({
      file: rel,
      samples: [...new Set(scrimSamples)].slice(0, 10),
      count: scrimSamples.length,
    });
  }
}

if (violations.length) {
  console.error("FAIL: raw hex in apps/web chrome (use var(--token) / CSS_TOKEN):\n");
  for (const v of violations) {
    console.error(`  ${v.file} (${v.count}) ${v.samples.join(" ")}`);
  }
  console.error(
    `\n${violations.length} file(s). Allowlist: SelectionFocusVeil mask #fff/#000; clientShareTwin atmosphere swatches / THREE.js render colours; APWA via color-tokens.`,
  );
  process.exit(1);
}

if (scrims.length) {
  console.error(
    "FAIL: scrim-strength black overlays (never-darkness law, TOKENS §1):\n",
  );
  for (const v of scrims) {
    console.error(`  ${v.file} (${v.count}) ${v.samples.join(" ")}`);
  }
  console.error(
    `\n${scrims.length} file(s). Dim with color-mix(in srgb, var(--gs-ink-strong) N%); lift with --gs-shadow-1..4.`,
  );
  process.exit(1);
}

console.log(
  `ok: no raw hex and no black scrims in ${files.length} apps/web files`,
);

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
 * `components/canvas/webgl/` is NOT on that list. It used to be, as a blanket
 * path exemption over the whole product surface; it is now classified
 * per-occurrence — see RENDER_VALUE_PATHS and chromeRegions() below.
 *
 * Third check (2026-08-22): a `var(--token, #hex)` fallback must equal the
 * token's real value. See VAR_FALLBACK.
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

/**
 * Paths where hex may legitimately be a *physical render value*, so each
 * occurrence is classified rather than the whole file being waved through.
 *
 * Until 2026-08-22 `components/canvas/webgl/` was a flat entry in
 * ALLOW_PATH_SUBSTR below — a blanket exemption over the entire product
 * surface. The justification ("Three.js material/light colours") is true for
 * material and light props, and false for everything else in the same files:
 * the WebGL studio's DOM chrome is inline `style={{}}` objects and SVG sheets
 * living beside the scene graph, so the exemption silently covered every panel
 * ink, chip colour and sheet stroke in the studio. Six chrome hex values had
 * accumulated behind it, including a duplicate of the documented Conflict
 * crimson and a duplicate of the Truth Anchor cobalt.
 *
 * The classifier is textual and deliberately conservative — see
 * `chromeRegions()` for what counts as chrome and the limits it cannot see.
 */
const RENDER_VALUE_PATHS = ["components/canvas/webgl/"];

/**
 * Scope floor, consistent with check-feature-reachability.mjs and
 * check-css-scales.mjs. A directory move that empties the classified scope must
 * fail loudly rather than degrade to "nothing to classify, all green".
 */
const FLOOR_RENDER_VALUE_FILES = 90;
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
];

/** Hex values permitted when they appear (mask / none). */
const ALLOW_HEX = new Set(["#fff", "#ffffff", "#000", "#000000"]);

/**
 * Walk from the `{` at `openIdx` to its matching `}`, skipping string and
 * template literals so a brace inside a quoted CSS value cannot unbalance the
 * count. Returns -1 if unbalanced.
 */
function matchBraces(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Object-literal openers that are DOM chrome paint by construction. Both
 * patterns end at the object's own `{`, so the brace walk starts at
 * `match.index + match[0].length - 1`.
 *
 * Anything else in a render-value path is treated as a render value. That is
 * the conservative direction on purpose: a false *chrome* positive would block
 * a legitimate material colour and get the gate widened again, which is how the
 * blanket exemption was justified in the first place.
 */
const CHROME_OBJECT_OPENERS = [
  // <div style={{ ... }}> — JSX inline style.
  /\bstyle=\{\{/g,
  // const foo: CSSProperties = { ... } — the WebGL studio's dominant form.
  /:\s*(?:React\.)?CSSProperties\s*=\s*\{/g,
];

/**
 * SVG presentation attributes carrying a string-literal hex. `stroke` and
 * `fill` are DOM/SVG paint and are not Three.js props, so a quoted hex on one
 * is unambiguously chrome. `color=` is deliberately NOT in this list: it is
 * both a DOM prop and the Three.js material/`<Line>` colour prop, so it cannot
 * be classified textually.
 */
const SVG_PAINT_ATTR =
  /\b(?:stroke|fill|stopColor|stop-color|floodColor|flood-color|lightingColor)\s*=\s*"(#[0-9a-fA-F]{3,8})"/g;

/**
 * Offset ranges in `src` that are DOM chrome paint.
 *
 * Limits, stated rather than pretended away:
 *  - A hex assigned to a module const and *used* in a style object reads as a
 *    render value, because only the literal's own position is classified. Every
 *    such const in the studio today (TRUTH_BLUE, SLICE_BLUE, CONFLICT_COLOR)
 *    genuinely feeds a Three.js material, but the indirection is a real hole.
 *  - `stroke={cond ? "#a" : "#b"}` is an expression container, not a string
 *    attribute, so it is not seen.
 *  - CSS-in-a-template-string is not seen.
 */
function chromeRegions(src) {
  const regions = [];
  for (const re of CHROME_OBJECT_OPENERS) {
    for (const m of src.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const close = matchBraces(src, open);
      if (close > open) regions.push([open, close]);
    }
  }
  for (const m of src.matchAll(SVG_PAINT_ATTR)) {
    regions.push([m.index, m.index + m[0].length]);
  }
  return regions;
}

const inRegion = (regions, i) => regions.some(([a, b]) => i >= a && i <= b);

/**
 * `var(--token, #hex)` — the fallback is good practice, but only if it is the
 * token's real value. A fallback that disagrees is worse than none: it never
 * renders (the token always resolves at :root), so it silently documents the
 * wrong design intent. Two had drifted through the Studio Paper pivot —
 * `var(--gs-primary, #FBBF24)` kept the pre-pivot amber for a token that is now
 * Signal Blue, and `var(--gs-warning, #c92)` kept an amber for a token that is
 * now neutral grey.
 */
const VAR_FALLBACK = /var\(\s*(--[a-zA-Z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g;

/** Token name -> declared value, from the two token stylesheets. */
function readTokenValues() {
  const map = new Map();
  for (const f of ["styles/color-tokens.css", "styles/globals.css"]) {
    const src = fs
      .readFileSync(path.join(ROOT, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
      if (!map.has(m[1])) map.set(m[1], m[2].trim());
    }
  }
  return map;
}

/** Follow `var(--a)` aliases to a concrete value. */
function resolveToken(map, name, seen = new Set()) {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const raw = map.get(name);
  if (!raw) return undefined;
  const alias = raw.match(/^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/);
  return alias ? resolveToken(map, alias[1], seen) : raw;
}

/** #abc -> #aabbcc, lowercased, for value comparison. */
function normaliseHex(h) {
  const s = h.toLowerCase();
  return s.length === 4
    ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
    : s;
}

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
const tokenValues = readTokenValues();
const violations = [];
const scrims = [];
const badFallbacks = [];
let renderValueFiles = 0;

/**
 * Comments are blanked to spaces rather than removed, so every offset below
 * still lines up with the original source (line numbers and region bounds).
 */
function blankComments(src, isCss) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  return isCss ? noBlock : noBlock.replace(/(^|[^:])(\/\/.*)$/gm, (_, p, c) => p + blank(c));
}

const lineOf = (src, i) => src.slice(0, i).split("\n").length;

for (const file of files) {
  const rel = file.replace(/\\/g, "/");
  if (ALLOW_PATH_SUBSTR.some((a) => rel.includes(a))) continue;

  const isCss = file.endsWith(".css");
  const raw = fs.readFileSync(file, "utf8");
  const src = stripComments(raw, isCss);
  const offsetSrc = blankComments(raw, isCss);

  if (RENDER_VALUE_PATHS.some((p) => rel.includes(p))) {
    /*
     * Classify each hex instead of skipping the file: chrome paint must be a
     * token, a material/light/shader value may stay literal.
     */
    renderValueFiles += 1;

    /*
     * `var(--token, #hex)` fallbacks must equal the token they back.
     *
     * Scoped to the classified paths, not the whole app, because the first
     * repo-wide run surfaced 48 more in components/ui/kit/kit.module.css
     * (`var(--ink-primary, #fff)` against a token that resolves to #1a1a1a,
     * plus `--ink-inverted` defined as `var(--gs-ink)` — a token that
     * contradicts its own name). That is a separate UI-kit audit with its own
     * blast radius; it is recorded in OUTSTANDING.md rather than folded into a
     * gate-repair MR. Widen RENDER_VALUE_PATHS when that lands.
     */
    for (const m of offsetSrc.matchAll(VAR_FALLBACK)) {
      const real = resolveToken(tokenValues, m[1]);
      if (!real || !/^#[0-9a-fA-F]{3,8}$/.test(real)) continue;
      if (normaliseHex(real) !== normaliseHex(m[2])) {
        badFallbacks.push({
          file: rel,
          line: lineOf(offsetSrc, m.index),
          token: m[1],
          wrote: m[2],
          real,
        });
      }
    }
    const regions = chromeRegions(offsetSrc);
    const chromeHex = [];
    for (const m of offsetSrc.matchAll(HEX)) {
      if (ALLOW_HEX.has(m[0].toLowerCase())) continue;
      if (!inRegion(regions, m.index)) continue;
      // Hex inside a var() fallback is the badFallbacks check's business.
      const before = offsetSrc.slice(Math.max(0, m.index - 64), m.index);
      if (/var\(\s*--[a-zA-Z0-9-]+\s*,\s*$/.test(before)) continue;
      chromeHex.push(`${m[0]}@L${lineOf(offsetSrc, m.index)}`);
    }
    if (chromeHex.length) {
      violations.push({
        file: rel,
        samples: chromeHex.slice(0, 10),
        count: chromeHex.length,
      });
    }
  } else {
    const hits = src.match(HEX) ?? [];
    const bad = hits.filter((h) => !ALLOW_HEX.has(h.toLowerCase()));
    if (bad.length) {
      violations.push({
        file: rel,
        samples: [...new Set(bad)].slice(0, 10),
        count: bad.length,
      });
    }
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

if (renderValueFiles < FLOOR_RENDER_VALUE_FILES) {
  console.error(
    "FAIL: this gate is no longer classifying the surface it claims to.\n" +
    `  render-value paths scanned ${renderValueFiles}, floor ${FLOOR_RENDER_VALUE_FILES}\n` +
    `  paths: ${RENDER_VALUE_PATHS.join(", ")}\n` +
    "\nRepoint RENDER_VALUE_PATHS at the real location. Do not lower the floor to pass.",
  );
  process.exit(1);
}

if (violations.length) {
  console.error("FAIL: raw hex in apps/web chrome (use var(--token) / CSS_TOKEN):\n");
  for (const v of violations) {
    console.error(`  ${v.file} (${v.count}) ${v.samples.join(" ")}`);
  }
  console.error(
    `\n${violations.length} file(s). Allowlist: SelectionFocusVeil mask #fff/#000; clientShareTwin atmosphere swatches / THREE.js render colours; APWA via color-tokens.\n` +
    "In a render-value path a hex is only reported when it sits in DOM chrome —\n" +
    "a style={{}} / CSSProperties object, or an SVG stroke=/fill= attribute.\n" +
    "Three.js material, light and shader values are untouched. If this fired on a\n" +
    "genuine render value, move it out of the style object; do not re-add a\n" +
    "blanket path exemption.",
  );
  process.exit(1);
}

if (badFallbacks.length) {
  console.error(
    "FAIL: var(--token, #hex) fallback disagrees with the token it backs:\n",
  );
  for (const b of badFallbacks) {
    console.error(
      `  ${b.file}:${b.line}\n    ${b.token} is ${b.real}, fallback says ${b.wrote}`,
    );
  }
  console.error(
    "\nThe token always resolves at :root, so a wrong fallback never renders — it\n" +
    "just documents the wrong design intent for the next reader. Match it, or\n" +
    "drop the fallback.",
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
  `ok: no raw hex, no black scrims and no drifted var() fallbacks in ` +
  `${files.length} apps/web files ` +
  `(${renderValueFiles} classified chrome-vs-render, floor ${FLOOR_RENDER_VALUE_FILES})`,
);

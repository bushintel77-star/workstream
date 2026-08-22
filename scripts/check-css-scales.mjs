/**
 * CI gate: freeze the off-scale CSS backlog and let it only shrink.
 *
 * `check-handoff-chrome-colors.mjs` is why colour adoption is ~99% — one gate,
 * enforced, and the drift stopped. Three axes had no equivalent:
 *
 *  - **z-index**: a documented 15-step scale exists (`--ws-z-*` in
 *    handoffStudio.module.css), and ~30% of declarations bypass it, including
 *    999 / 1000 / 1100 — the "I need to be on top" escapes that defeat a
 *    layering model entirely.
 *  - **border-radius**: 16 distinct raw px values in use.
 *  - **opacity**: 35 distinct raw decimals, which is the measurable form of
 *    "everything on the canvas reads at the same weight".
 *
 * This is a **baseline ratchet, not a ban.** Clearing ~350 call sites in one
 * sweep would be an unreviewable diff across every canvas surface, and a gate
 * that lands red gets reverted rather than adopted. So the current count per
 * file is recorded in `css-scales-baseline.json` and the gate fails when a file
 * goes *up*, or when a file with no recorded debt gains any. Going down is
 * rewarded: the gate also fails on a stale baseline, so improving a file forces
 * its number to be lowered and the ratchet tightens permanently.
 *
 * Opacity is counted, not token-checked, because there is no opacity scale to
 * check against yet — the ink-tier scale is still unbuilt (see 00-DISCOVERY
 * §4.1). Freezing the count stops it growing while that design lands.
 *
 * Usage:
 *   node scripts/check-css-scales.mjs
 *   node scripts/check-css-scales.mjs --update   # after a deliberate reduction
 */
import fs from "fs";
import path from "path";

const ROOT = "apps/web/src";
const BASELINE = "scripts/css-scales-baseline.json";

/**
 * Floors, so a directory move cannot silently empty this gate.
 *
 * Until 2026-08-22 this script walked `.css` files only. That was correct when
 * the SVG studio owned the product surface, but the WebGL studio imports **zero**
 * CSS modules — every one of its chrome surfaces is an inline `style={{}}` object.
 * So the gate held a green baseline over 23 files while the surface that ships
 * was unmeasurable by construction. The `.tsx` axes below close that, and these
 * floors make the next such collapse loud instead of silent.
 */
const FLOOR_CSS_FILES = 20;
const FLOOR_TSX_FILES = 60;

/**
 * Each axis: how to find an off-scale declaration. A declaration that uses
 * `var(--token)` is on-scale by definition and never counted.
 */
const AXES = {
  zIndex: {
    label: "raw z-index (use var(--ws-z-*))",
    re: /z-index:\s*([^;]+);/g,
    offScale: (v) => !v.includes("var(--"),
  },
  radius: {
    label: "raw border-radius px (use a radius token)",
    re: /border-radius:\s*([^;]+);/g,
    offScale: (v) => !v.includes("var(--") && /\d/.test(v) && !/^0\b/.test(v.trim()),
  },
  opacity: {
    label: "raw opacity decimal (no scale exists yet — do not add more)",
    re: /(?<!-)\bopacity:\s*([^;]+);/g,
    offScale: (v) => !v.includes("var(--") && /^0?\.\d+$/.test(v.trim()),
  },
};

/**
 * Inline-style axes for `.tsx`, where the WebGL studio's chrome actually lives.
 *
 * The value capture stops at `,` `}` or a newline — one object property. A
 * ternary counts as one declaration, which is right: it is one decision about
 * one property.
 *
 * `zIndex` is the axis that matters most and is expected to stay at **zero**.
 * The four `no-restricted-syntax` selectors that used to ban raw z-index are
 * shadowed off for `canvas/**` by a later config block in `eslint.config.mjs`,
 * so this is currently the only guard on the studio's z-ladder. Use
 * `cfZPair()` / `var(--cf-z-*)`.
 *
 * Radius and opacity are deliberately NOT scanned in `.tsx`: Three.js material
 * and light properties are written as object literals in the same files
 * (`{ opacity: 0.4 }` on a material is a physical render value, not chrome
 * paint), and there is no way to tell them apart textually. Counting them would
 * make the baseline mostly noise, which is how a ratchet gets ignored. The
 * handoff-colour gate already draws this same material-vs-chrome line.
 */
const TSX_AXES = {
  inlineZIndex: {
    label: "raw inline zIndex (use cfZPair() or var(--cf-z-*))",
    re: /\bzIndex:\s*([^,\n}]+)/g,
    offScale: (v) => {
      const t = v.trim();
      if (t.includes("var(--") || /\b(cfZ|readCfZ|CF_Z)/.test(t)) return false;
      return /(^|[^\w.-])\d/.test(t);
    },
  },
  inlineZIndexRange: {
    label: "raw drei zIndexRange pair (use cfZPair())",
    re: /\bzIndexRange=\{(\[[^\]]*\])/g,
    offScale: (v) => !/\bcfZPair\b/.test(v) && /\d/.test(v),
  },
};

/** Every axis by name, for label lookup and diffing across both file types. */
const ALL_AXES = { ...AXES, ...TSX_AXES };

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
    else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

const rel = (f) => f.replace(/\\/g, "/");

/** Comments never count — a note about a raw value is not a raw value. */
function stripComments(src, isCss) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return isCss ? noBlock : noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Current off-scale counts, keyed by posix path, only for files with debt. */
function measure() {
  const counts = {};
  const scanned = { css: 0, tsx: 0 };
  for (const file of walk(ROOT)) {
    const isCss = file.endsWith(".css");
    scanned[isCss ? "css" : "tsx"] += 1;
    const src = stripComments(fs.readFileSync(file, "utf8"), isCss);
    const per = {};
    for (const [axis, { re, offScale }] of Object.entries(
      isCss ? AXES : TSX_AXES,
    )) {
      let n = 0;
      for (const m of src.matchAll(new RegExp(re.source, re.flags))) {
        if (offScale(m[1])) n += 1;
      }
      if (n > 0) per[axis] = n;
    }
    if (Object.keys(per).length) counts[rel(file)] = per;
  }
  return { counts, scanned };
}

const { counts: current, scanned } = measure();

if (scanned.css < FLOOR_CSS_FILES || scanned.tsx < FLOOR_TSX_FILES) {
  console.error(
    "FAIL: this gate is no longer measuring the surface it claims to.\n" +
    `  .css scanned ${scanned.css}, floor ${FLOOR_CSS_FILES}\n` +
    `  .tsx scanned ${scanned.tsx}, floor ${FLOOR_TSX_FILES}\n` +
    "\nRepoint ROOT at the real location. Do not lower a floor to pass.",
  );
  process.exit(1);
}

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  const total = Object.values(current).reduce(
    (a, per) => a + Object.values(per).reduce((x, y) => x + y, 0),
    0,
  );
  console.log(
    `baseline written: ${Object.keys(current).length} files, ${total} off-scale declarations`,
  );
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error(
    `FAIL: ${BASELINE} is missing. Run: node scripts/check-css-scales.mjs --update`,
  );
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const grown = [];
const improved = [];

const files = new Set([...Object.keys(current), ...Object.keys(baseline)]);
for (const file of files) {
  for (const axis of Object.keys(ALL_AXES)) {
    const now = current[file]?.[axis] ?? 0;
    const was = baseline[file]?.[axis] ?? 0;
    if (now > was) grown.push({ file, axis, now, was });
    else if (now < was) improved.push({ file, axis, now, was });
  }
}

if (grown.length) {
  console.error("FAIL: off-scale CSS grew. Use the documented scale:\n");
  for (const g of grown) {
    console.error(
      `  ${g.file}\n    ${ALL_AXES[g.axis].label}: ${g.was} -> ${g.now}`,
    );
  }
  console.error(
    "\nCSS z-index: var(--ws-z-*) — the 15-step scale in handoffStudio.module.css\n" +
      "             (SVG-era surfaces only; the WebGL studio uses the --cf-z ladder).\n" +
      "inline zIndex: cfZPair() or var(--cf-z-*) — the 4-tier Canvas-First ladder.\n" +
      "radius:      an existing radius token, not a new px value.\n" +
      "opacity:     reuse a value already on the surface; do not invent a new step.",
  );
  process.exit(1);
}

if (improved.length) {
  console.error(
    "FAIL: the baseline is stale — these improved, so lower the recorded numbers\n" +
      "(node scripts/check-css-scales.mjs --update) to lock the gain in:\n",
  );
  for (const i of improved) {
    console.error(
      `  ${i.file}\n    ${ALL_AXES[i.axis].label}: ${i.was} -> ${i.now}`,
    );
  }
  process.exit(1);
}

const total = Object.values(current).reduce(
  (a, per) => a + Object.values(per).reduce((x, y) => x + y, 0),
  0,
);
console.log(
  `ok: off-scale styling held at baseline (${Object.keys(current).length} files, ` +
  `${total} declarations; scanned ${scanned.css} .css + ${scanned.tsx} .tsx)`,
);

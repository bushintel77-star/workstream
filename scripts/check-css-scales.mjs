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

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

const rel = (f) => f.replace(/\\/g, "/");

/** Current off-scale counts, keyed by posix path, only for files with debt. */
function measure() {
  const counts = {};
  for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const per = {};
    for (const [axis, { re, offScale }] of Object.entries(AXES)) {
      let n = 0;
      for (const m of src.matchAll(new RegExp(re.source, re.flags))) {
        if (offScale(m[1])) n += 1;
      }
      if (n > 0) per[axis] = n;
    }
    if (Object.keys(per).length) counts[rel(file)] = per;
  }
  return counts;
}

const current = measure();

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
  for (const axis of Object.keys(AXES)) {
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
      `  ${g.file}\n    ${AXES[g.axis].label}: ${g.was} -> ${g.now}`,
    );
  }
  console.error(
    "\nz-index: var(--ws-z-*) — the 15-step scale in handoffStudio.module.css.\n" +
      "radius:  an existing radius token, not a new px value.\n" +
      "opacity: reuse a value already on the surface; do not invent a new step.",
  );
  process.exit(1);
}

if (improved.length) {
  console.error(
    "FAIL: the baseline is stale — these improved, so lower the recorded numbers\n" +
      "(node scripts/check-css-scales.mjs --update) to lock the gain in:\n",
  );
  for (const i of improved) {
    console.error(`  ${i.file}\n    ${AXES[i.axis].label}: ${i.was} -> ${i.now}`);
  }
  process.exit(1);
}

const total = Object.values(current).reduce(
  (a, per) => a + Object.values(per).reduce((x, y) => x + y, 0),
  0,
);
console.log(
  `ok: off-scale CSS held at baseline (${Object.keys(current).length} files, ${total} declarations)`,
);

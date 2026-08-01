/**
 * CI gate: forbid raw hex colour literals in apps/web CSS/TSX outside
 * allowlist. Originally handoff-only; broadened to all of apps/web/src so
 * the "scrub hardcoded colour" pass on every page (not just the canvas
 * studio) stays enforced.
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

console.log(`ok: no raw hex in ${files.length} apps/web files`);

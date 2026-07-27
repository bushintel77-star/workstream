/**
 * CI gate: forbid raw #hex in handoff chrome CSS/TSX outside allowlist.
 *
 * Allowlist:
 * - color-tokens.css / colorTokens.ts (token source of truth)
 * - SVG mask algebra #fff/#000 in SelectionFocusVeil
 * - Comments containing hex
 * - APWA palette only inside colorTokens.ts (already SoT)
 *
 * Usage: node scripts/check-handoff-chrome-colors.mjs
 */
import fs from "fs";
import path from "path";

const HANDOFF = "apps/web/src/components/canvas/handoff";
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/** Paths (posix) that may contain literal hex. */
const ALLOW_PATH_SUBSTR = [
  // Mask algebra — not chrome paint
  "features/selectionFocus/SelectionFocusVeil.tsx",
];

/** Hex values permitted when they appear (mask / none). */
const ALLOW_HEX = new Set(["#fff", "#ffffff", "#000", "#000000"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(module\.css|tsx|ts)$/.test(ent.name) && !ent.name.endsWith(".test.ts"))
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

const files = walk(HANDOFF);
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
  console.error("FAIL: raw hex in handoff chrome (use var(--hc-*) / CSS_TOKEN):\n");
  for (const v of violations) {
    console.error(`  ${v.file} (${v.count}) ${v.samples.join(" ")}`);
  }
  console.error(
    `\n${violations.length} file(s). Allowlist: SelectionFocusVeil mask #fff/#000; APWA via color-tokens.`,
  );
  process.exit(1);
}

console.log(`ok: no raw hex in ${files.length} handoff chrome files`);

/**
 * Mechanical scrub: replace known blush/hardcoded hex + rgba in handoff
 * chrome CSS with --hc-* / v2 semantic vars.
 *
 * Allowlisted paths (skipped): none for CSS modules — material hex in
 * studioCatalog TS is out of scope for this script.
 *
 * Usage: node scripts/scrub-handoff-chrome-colors.mjs [--check]
 */
import fs from "fs";
import path from "path";

const ROOT = "apps/web/src/components/canvas/handoff";
const checkOnly = process.argv.includes("--check");

/** @type {Array<[RegExp, string]>} */
const REPLACEMENTS = [
  // ── Ink / text neutrals ──
  [/#1c1917\b/gi, "var(--hc-ink)"],
  [/#292524\b/gi, "var(--hc-ink)"],
  [/#1a1216\b/gi, "var(--hc-ink)"],
  [/#57534e\b/gi, "var(--hc-ink-muted)"],
  [/#44403c\b/gi, "var(--hc-ink-muted)"],
  [/#6b6560\b/gi, "var(--hc-ink-muted)"],
  [/#78716c\b/gi, "var(--hc-ink-faint)"],
  [/#8c8a85\b/gi, "var(--hc-ink-faint)"],
  [/#5c5a55\b/gi, "var(--hc-ink-faint)"],
  [/#5a4650\b/gi, "var(--hc-ink-muted)"],
  [/#d3b3bc\b/gi, "var(--hc-ink-faint)"],
  [/#e6e9ea\b/gi, "var(--hc-ink-faint)"],
  // ── Paper / canvas surfaces ──
  [/#faf6f2\b/gi, "var(--sheet-paper)"],
  [/#f7f4ef\b/gi, "var(--sheet-paper)"],
  [/#F7F4EF\b/g, "var(--sheet-paper)"],
  [/#f2f0eb\b/gi, "var(--canvas)"],
  [/#f0e8e2\b/gi, "var(--sheet-paper)"],
  [/#f0ebe4\b/gi, "var(--sheet-paper)"],
  [/#faf8f5\b/gi, "var(--sheet-paper)"],
  [/#ebe8e2\b/gi, "var(--canvas)"],
  [/#fff\b/g, "var(--hc-paper)"],
  [/#ffffff\b/gi, "var(--hc-paper)"],
  // ── Blush leftovers ──
  [/#241318\b/gi, "var(--hc-ink)"],
  [/#7a5560\b/gi, "var(--hc-ink-muted)"],
  [/#8a7a82\b/gi, "var(--hc-ink-muted)"],
  [/#9a8a90\b/gi, "var(--hc-ink-faint)"],
  [/#b08a95\b/gi, "var(--hc-ink-faint)"],
  [/#f1e4e9\b/gi, "var(--hc-neu-surface)"],
  [/#f6ebef\b/gi, "var(--hc-neu-raised)"],
  [/#f6eaed\b/gi, "var(--hc-neu-surface)"],
  [/#fffbfc\b/gi, "var(--hc-paper)"],
  [/#fff6f8\b/gi, "var(--hc-invert)"],
  [/#ffd3de\b/gi, "var(--hc-accent-wash)"],
  [/#f1d7dd\b/gi, "var(--hc-accent-wash)"],
  // ── Status ──
  [/#2f6f4e\b/gi, "var(--hc-success)"],
  [/#1f7a53\b/gi, "var(--hc-success)"],
  [/#1f8a5a\b/gi, "var(--hc-success)"],
  [/#a33a4a\b/gi, "var(--hc-danger)"],
  [/#a72f48\b/gi, "var(--hc-danger)"],
  [/#a93951\b/gi, "var(--hc-danger)"],
  [/#c2455f\b/gi, "var(--hc-danger)"],
  [/#d66b6b\b/gi, "var(--hc-danger)"],
  [/#ef4444\b/gi, "var(--hc-danger)"],
  [/#dc2626\b/gi, "var(--hc-danger)"],
  [/#b91c1c\b/gi, "var(--hc-danger)"],
  [/#e8b84b\b/gi, "var(--hc-warning)"],
  [/#c99757\b/gi, "var(--hc-warning)"],
  // ── Dark chrome / misc ──
  [/#212830\b/gi, "var(--panel)"],
  [/#ddd5d0\b/gi, "var(--grid-line)"],
  [/#eceff4\b/gi, "var(--hc-ink)"],
  [/#16181c\b/gi, "var(--hc-invert)"],
  [/#1b1e24\b/gi, "var(--hc-paper)"],
  [/#232730\b/gi, "var(--hc-neu-surface)"],
  [/#2a2f39\b/gi, "var(--hc-neu-raised)"],
  // ── Neumorphic white highlights ──
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.85\s*\)/g, "var(--hc-neu-light)"],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.(?:45|48|65|66)\s*\)/g, "var(--hc-neu-light)"],
  // ── Blush ink rgba (36,19,24) ──
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.(?:35|4|28)\s*\)/g, "var(--hc-line)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.(?:18|16|15)\s*\)/g, "var(--hc-line)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.14\s*\)/g, "var(--hc-line)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.12\s*\)/g, "var(--hc-line)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.1(?:0)?\s*\)/g, "var(--hc-line-soft)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.0(?:4|6|7|8)\s*\)/g, "var(--hc-line-soft)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.03\s*\)/g, "var(--hc-line-soft)"],
  [/rgba\(\s*36\s*,\s*19\s*,\s*24\s*,\s*0\.88\s*\)/g, "var(--hc-ink)"],
  // ── Stone ink rgba (28,25,23) ──
  [/rgba\(\s*28\s*,\s*25\s*,\s*23\s*,\s*0\.35\s*\)/g, "var(--sheet-border, var(--hc-line))"],
  [/rgba\(\s*28\s*,\s*25\s*,\s*23\s*,\s*0\.1\s*\)/g, "var(--hc-line-soft)"],
  [/rgba\(\s*28\s*,\s*25\s*,\s*23\s*,\s*0\.08\s*\)/g, "var(--hc-line-soft)"],
  // ── Blush shadow rgba (42,23,29) ──
  [/rgba\(\s*42\s*,\s*23\s*,\s*29\s*,\s*0\.(?:3|28|2)\s*\)/g, "var(--hc-neu-shadow)"],
  [/rgba\(\s*42\s*,\s*23\s*,\s*29\s*,\s*0\.(?:08|07|1)\s*\)/g, "var(--hc-neu-shadow)"],
  [/rgba\(\s*42\s*,\s*23\s*,\s*29\s*,\s*0\.92\s*\)/g, "var(--hc-ink)"],
  // ── Glass / paper rgba ──
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.97\s*\)/g, "var(--hc-glass)"],
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.96\s*\)/g, "var(--hc-glass)"],
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.94\s*\)/g, "var(--hc-glass-soft)"],
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.92\s*\)/g, "var(--hc-glass)"],
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.9\s*\)/g, "var(--hc-glass)"],
  [/rgba\(\s*255\s*,\s*251\s*,\s*252\s*,\s*0\.(?:82|88|62|6|56|54|45|36)\s*\)/g, "var(--hc-glass-soft)"],
  [/rgba\(\s*255\s*,\s*252\s*,\s*247\s*,\s*0\.96\s*\)/g, "var(--hc-glass)"],
  [/rgba\(\s*250\s*,\s*246\s*,\s*242\s*,\s*0\.(?:55|22)\s*\)/g, "color-mix(in srgb, var(--sheet-paper) 55%, transparent)"],
  [/rgba\(\s*255\s*,\s*246\s*,\s*248\s*,\s*0\.(?:55|72|06|05|1)\s*\)/g, "var(--hc-glass-soft)"],
  [/rgba\(\s*246\s*,\s*234\s*,\s*237\s*,\s*0\.(?:92|7)\s*\)/g, "var(--hc-glass-soft)"],
  // ── Dark-mode muted ink (opacity-specific) ──
  [/rgba\(\s*236\s*,\s*239\s*,\s*244\s*,\s*0\.92\s*\)/g, "color-mix(in srgb, var(--hc-ink) 92%, transparent)"],
  [/rgba\(\s*236\s*,\s*239\s*,\s*244\s*,\s*0\.72\s*\)/g, "color-mix(in srgb, var(--hc-ink) 72%, transparent)"],
  [/rgba\(\s*236\s*,\s*239\s*,\s*244\s*,\s*0\.08\s*\)/g, "color-mix(in srgb, var(--hc-ink) 8%, transparent)"],
  [/rgba\(\s*230\s*,\s*233\s*,\s*234\s*,\s*0\.(?:2|16)\s*\)/g, "var(--hc-line-soft)"],
  // ── Status rgba ──
  [/rgba\(\s*232\s*,\s*184\s*,\s*75\s*,\s*0\.(?:45|25)\s*\)/g, "color-mix(in srgb, var(--hc-warning) 45%, transparent)"],
  [/rgba\(\s*194\s*,\s*69\s*,\s*95\s*,\s*0\.(?:54|4|35|28|2|16)\s*\)/g, "color-mix(in srgb, var(--hc-danger) 35%, transparent)"],
  [/rgba\(\s*255\s*,\s*211\s*,\s*222\s*,\s*0\.\d+\s*\)/g, "var(--hc-accent-wash)"],
  [/rgba\(\s*42\s*,\s*23\s*,\s*29\s*,\s*0\.1(?:0|2|4|6|8)?\s*\)/g, "var(--hc-neu-shadow)"],
  // ── Drop redundant self-referential fallbacks ──
  [/var\(--hc-neu-surface,\s*var\(--hc-neu-surface\)\)/g, "var(--hc-neu-surface)"],
  [/var\(--hc-neu-raised,\s*var\(--hc-neu-raised\)\)/g, "var(--hc-neu-raised)"],
  [/var\(--hc-ink,\s*var\(--hc-ink\)\)/g, "var(--hc-ink)"],
  [/var\(--hc-ink-muted,\s*var\(--hc-ink-muted\)\)/g, "var(--hc-ink-muted)"],
  [/var\(--hc-ink-faint,\s*var\(--hc-ink-faint\)\)/g, "var(--hc-ink-faint)"],
  [/var\(--hc-line,\s*var\(--hc-line\)\)/g, "var(--hc-line)"],
  [/var\(--hc-line-soft,\s*var\(--hc-line-soft\)\)/g, "var(--hc-line-soft)"],
  [/var\(--hc-glass,\s*var\(--hc-glass\)\)/g, "var(--hc-glass)"],
  [/var\(--hc-glass-soft,\s*var\(--hc-glass-soft\)\)/g, "var(--hc-glass-soft)"],
  [/var\(--hc-paper,\s*var\(--hc-paper\)\)/g, "var(--hc-paper)"],
  [/var\(--hc-invert,\s*var\(--hc-invert\)\)/g, "var(--hc-invert)"],
  [/var\(--hc-neu-shadow,\s*var\(--hc-neu-shadow\)\)/g, "var(--hc-neu-shadow)"],
  [/var\(--hc-neu-light,\s*var\(--hc-neu-light\)\)/g, "var(--hc-neu-light)"],
  [/var\(--hc-r-control,\s*var\(--hc-r-control\)\)/g, "var(--hc-r-control)"],
  [/var\(--hc-elev-1,\s*var\(--hc-elev-1\)\)/g, "var(--hc-elev-1)"],
  [/var\(--hc-elev-2,\s*var\(--hc-elev-2\)\)/g, "var(--hc-elev-2)"],
  [/var\(--hc-motion,\s*var\(--hc-motion\)\)/g, "var(--hc-motion)"],
];

/** Strip hex/rgba fallbacks from semantic var() calls. */
const FALLBACK_STRIPS = [
  [/var\((--hc-[a-z0-9-]+),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"],
  [/var\((--hc-[a-z0-9-]+),\s*rgba?\([^)]+\)\)/g, "var($1)"],
  [/var\((--proposed-stroke),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"],
  [/var\((--existing-stroke),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"],
  [/var\((--sds-vector-muted),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"],
  [/var\((--sds-vector-primary),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"],
  [/var\((--hc-elev-[123]),\s*0[^)]+\)/g, "var($1)"],
  [/var\((--hc-r-control),\s*\d+px\)/g, "var($1)"],
];

/** APWA / material / plan-semantic hex — report only, do not auto-replace. */
const ALLOWLIST_HEX = new Set([
  "#1e88c7", "#2f8f4e", "#e8b000", "#d63b2f", "#e8722f", "#8b4fc7",
  "#2450c7", "#3d6be0", "#b33a32", "#2f5d3a", "#4b8f5e", "#5b7fbf",
  "#8b6f4e", "#7c8791", "#b98a5e", "#2e86ab", "#a69c8e",
  "#139b3a", "#139b3a", "#4a90d9", "#e8a030",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".module.css")) out.push(p);
  }
  return out;
}

function classifyHex(hex) {
  const h = hex.toLowerCase();
  if (ALLOWLIST_HEX.has(h)) return "allowlist";
  if (/^#(?:f[0-9a-f]{5}|ff[0-9a-f]{4})$/i.test(h)) return "blush";
  return "manual";
}

const files = walk(ROOT);
let changedFiles = 0;
const leftover = [];

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  for (const [re, to] of REPLACEMENTS) {
    src = src.replace(re, to);
  }
  for (const [re, to] of FALLBACK_STRIPS) {
    src = src.replace(re, to);
  }

  if (src !== before) {
    changedFiles++;
    if (!checkOnly) fs.writeFileSync(file, src);
  }

  const hexHits = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  if (hexHits.length) {
    const unique = [...new Set(hexHits.map((h) => h.toLowerCase()))];
    leftover.push({
      file,
      count: hexHits.length,
      samples: unique.slice(0, 10),
      allowlist: unique.filter((h) => classifyHex(h) === "allowlist"),
      manual: unique.filter((h) => classifyHex(h) === "manual"),
      blush: unique.filter((h) => classifyHex(h) === "blush"),
    });
  }
}

console.log(
  checkOnly
    ? `check: ${files.length} css modules, ${leftover.length} still have hex`
    : `scrubbed ${changedFiles}/${files.length} css modules`,
);

const allowlistRows = leftover.filter((r) => r.allowlist.length);
const manualRows = leftover.filter((r) => r.manual.length);
const blushRows = leftover.filter((r) => r.blush.length);

if (allowlistRows.length) {
  console.log(`\nallowlist (${allowlistRows.length} files):`);
  for (const row of allowlistRows.slice(0, 20)) {
    console.log(`  ${row.file}: ${row.allowlist.join(" ")}`);
  }
}

if (manualRows.length) {
  console.log(`\nstill need manual (${manualRows.length} files):`);
  for (const row of manualRows.slice(0, 30)) {
    console.log(`  ${row.file} (${row.count}) ${row.manual.join(" ")}`);
  }
}

if (blushRows.length) {
  console.log(`\nblush leftovers (${blushRows.length} files):`);
  for (const row of blushRows) {
    console.log(`  ${row.file}: ${row.blush.join(" ")}`);
  }
}

if (checkOnly && blushRows.length) {
  console.error("FAIL: blush palette still present");
  process.exit(1);
}

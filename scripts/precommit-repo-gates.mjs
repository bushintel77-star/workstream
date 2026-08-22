/**
 * The parts of `pnpm run ci` that a staged-file list cannot find on its own.
 *
 * Two blind spots, both of which have already let a red gate through a green
 * commit hook:
 *
 *  1. **Repo-wide ratchets.** `check-css-scales`, `check-feature-reachability`
 *     and friends measure the whole tree. Nothing about the file you staged
 *     tells you whether you moved one of them off its scope, and they are all
 *     pure file readers — the eight of them together cost about 0.6s, so there
 *     is no latency argument for skipping them.
 *
 *  2. **Source-scraping specs.** Eight unit tests read repo files with
 *     `readFileSync` / `readdirSync` instead of importing them —
 *     `ui.lint.test.ts` and `cfz.lint.test.ts` parse `eslint.config.mjs` as
 *     text, `cfz.parity.test.ts` parses `globals.css`, `cfz.migration.test.ts`
 *     parses `package.json`. Those dependencies are invisible to Vitest's
 *     module graph, so `vitest related` will never select them no matter what
 *     you stage. That is precisely how an ESLint config refactor shipped on
 *     2026-08-22 with a green commit hook and a broken unit test.
 *
 * The scraping list is **discovered, not hardcoded**, so a new spec of the same
 * shape is covered the day it is written rather than the day someone remembers
 * to add it here.
 *
 * Usage:
 *   node scripts/precommit-repo-gates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * The `pnpm run ci` steps that are pure file readers. `web:check-bundle-size`
 * is deliberately absent — it runs a full Next build, which is minutes, and a
 * hook that slow gets bypassed with `--no-verify`, which is worse than a hook
 * that is honest about its scope.
 */
const RATCHETS = [
  "scripts/check-mobile-placeholders.mjs",
  "scripts/check-mobile-distribution.mjs",
  "scripts/check-portal-edge.mjs",
  "scripts/check-handoff-chrome-colors.mjs",
  "scripts/check-ui-token-parity.mjs",
  "scripts/check-studio-dialect.mjs",
  "scripts/check-feature-reachability.mjs",
  "scripts/check-css-scales.mjs",
];

/** Where unit tests live. A miss here is loud: see FLOOR_SCRAPING_SPECS. */
const TEST_ROOTS = ["apps", "packages"];

/**
 * Floor, for the same reason every other gate in this repo has one: a walk over
 * a path that moved returns `[]`, and `[]` reads as "nothing to check".
 * At the time of writing the scan finds 8.
 */
const FLOOR_SCRAPING_SPECS = 6;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.test\.tsx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

/** Specs whose real inputs are files on disk, not imports. */
function findScrapingSpecs() {
  const found = [];
  for (const root of TEST_ROOTS) {
    for (const file of walk(root)) {
      const src = fs.readFileSync(file, "utf8");
      if (/\b(readFileSync|readdirSync)\s*\(/.test(src)) {
        found.push(file.replace(/\\/g, "/"));
      }
    }
  }
  return found;
}

/**
 * `shell` is opt-in per call: on Windows `pnpm` resolves to a `.cmd` shim and
 * needs it, while `process.execPath` is `C:\Program Files\nodejs\node.exe` and
 * gets torn in half at the space if the shell parses it.
 */
function run(cmd, args, { shell = false } = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", shell }).status ?? 1;
}

for (const script of RATCHETS) {
  if (!fs.existsSync(script)) {
    console.error(
      `FAIL: ${script} is listed in scripts/precommit-repo-gates.mjs but does not exist.\n` +
        "Repoint it at the script that replaced it. Do not delete the entry to get a green hook.",
    );
    process.exit(1);
  }
  if (run(process.execPath, [script]) !== 0) {
    console.error(`\nFAIL: ${script} — this would fail \`pnpm run ci\`.`);
    process.exit(1);
  }
}

const specs = findScrapingSpecs();
if (specs.length < FLOOR_SCRAPING_SPECS) {
  console.error(
    "FAIL: the source-scraping spec scan is no longer finding the tests it exists for.\n" +
      `  found ${specs.length}, floor ${FLOOR_SCRAPING_SPECS}\n\n` +
      "Repoint TEST_ROOTS at the real location. Do not lower the floor to pass.",
  );
  process.exit(1);
}

if (
  /* `--silent=true`, not `--silent`: a bare flag swallows the first spec path. */
  run("pnpm", ["exec", "vitest", "run", "--silent=true", ...specs], { shell: true }) !== 0
) {
  console.error(
    "\nFAIL: a spec that reads repo files as text is red.\n" +
      "These never show up in `vitest related` — that is why they run on every commit.",
  );
  process.exit(1);
}

console.log(
  `ok: ${RATCHETS.length} repo ratchets and ${specs.length} source-scraping specs green.`,
);

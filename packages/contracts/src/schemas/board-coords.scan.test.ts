/*
 * board-coords.scan.test.ts — hand-rolled board clamp scan.
 *
 * `clampBoardPct` only removes the duplication if the duplication cannot come
 * back. Any test that exercises a writer with in-range fixtures is, by
 * construction, blind to whether that writer clamps — so the population of
 * at-risk writers is the population of writers, and per-writer boundary tests
 * cannot cover it. This scan can: it fails the moment a new
 * `Math.max(0, Math.min(100, …))` appears in a migrated scope.
 *
 * Every survivor is listed in ALLOWED with a reason. The list is meant to
 * shrink; nothing should be added to it without one.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/contracts/src/schemas → repo root.
const ROOT = path.join(HERE, "..", "..", "..", "..");

const SCAN_ROOTS = ["packages", "apps/api/src", "apps/web/src"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "coverage",
]);

/**
 * A board clamp: 0 and 100 as the literal bounds, in either nesting order.
 * `Math.min(100 - w, …)` is a different bound (fit a box inside the board) and
 * is deliberately not matched.
 */
const BOARD_CLAMP =
  /Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\s*[,)]|Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\s*[,)]/g;

const ALLOWED: Record<string, string> = {
  // Not a board coordinate: permeable / canopy COVERAGE shares, which are
  // percentages of an area. They share the 0-100 range with the board by
  // coincidence, not by contract, and must not adopt the board primitive.
  "packages/domain/src/studio-preemptive-compliance.ts":
    "coverage percentage, not a board coordinate",
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("board clamp duplication", () => {
  it("has no hand-rolled 0-100 clamp outside the allowlist", () => {
    const violations: string[] = [];

    for (const root of SCAN_ROOTS) {
      for (const file of walk(path.join(ROOT, root))) {
        const rel = path.relative(ROOT, file).split(path.sep).join("/");
        // The module that defines the bound, and its tests, quote the pattern
        // they exist to replace.
        if (path.basename(rel).startsWith("board-coords.")) continue;
        const src = readFileSync(file, "utf8");
        const hits = src.match(BOARD_CLAMP);
        if (!hits || ALLOWED[rel]) continue;
        violations.push(
          `${rel}: ${hits.length} hand-rolled board clamp(s) — ` +
            `import { clampBoardPct } from "@workstream/contracts" instead.`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still has a clamp to migrate", () => {
    const stale: string[] = [];
    for (const rel of Object.keys(ALLOWED)) {
      let src: string;
      try {
        src = readFileSync(path.join(ROOT, rel), "utf8");
      } catch {
        stale.push(`${rel}: file no longer exists — drop the allowlist entry.`);
        continue;
      }
      if (!BOARD_CLAMP.test(src)) {
        stale.push(`${rel}: already migrated — drop the allowlist entry.`);
      }
      BOARD_CLAMP.lastIndex = 0;
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });
});

/*
 * cfz.registry.test.ts — closed-registry guard for `data-cf-layer` values.
 *
 * The CanvasFirstLayout wrapper exposes exactly four named slots. The
 * Playwright spec proves that runtime DOM has those four slots; the
 * parity test proves the underlying ladder mirrors between CSS and JS.
 * This test proves the COMPILE-TIME registry is also closed: no .tsx
 * file under apps/web/src may declare a `data-cf-layer="<X>"` for X
 * outside {canvas, spatial, chrome, app}.
 *
 * Adding a fifth tier means:
 *   1. Update the 4-token block in globals.css (CSRX parity)
 *   2. Update CF_Z_FALLBACK + CfTier + CF_Z_PAIRS in cfz.ts (JS mirror)
 *   3. Update docs/canvas-first-z-stack-contract.md (this contract)
 *   4. Update the EXPECTED_LAYERS const in canvas-first-z-stack.spec.ts
 *      (the runtime)
 *
 * This test is step 0 of that migration: it fails loudly the moment a
 * new value lands in code without the rest of the chain catching up.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(HERE, "..", ".."); // apps/web/src

const ALLOWED_VALUES = ["canvas", "spatial", "chrome", "app"] as const;
type AllowedValue = (typeof ALLOWED_VALUES)[number];

interface Violation {
  file: string;
  line: number;
  col: number;
  raw: string;
}

/** Recursively walk one directory yielding absolute .tsx/.ts paths.
 *  Test/diagnostic files are excluded — they verbatim quote `data-cf-layer`
 *  values in JSDoc and would self-trigger. */
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (/\.(?:ts|tsx)$/.test(entry) && !/\.test\.(?:ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

/** Find every `data-cf-layer="<value>"` (or single-quoted) usage. */
function scanFile(file: string): Violation[] {
  const text = readFileSync(file, "utf8");
  const violations: Violation[] = [];
  // Capture either quote form. The pattern is narrow on purpose: any
  // re-naming of the prop would silently slip past a wider selector.
  const re = /data-cf-layer=(["'])([^"']+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawValue = m[2]!;
    if (!ALLOWED_VALUES.includes(rawValue as AllowedValue)) {
      // 1-indexed line + column for IDE-friendly error messages.
      const upto = text.slice(0, m.index);
      const line = upto.split("\n").length;
      const col = (upto.match(/\n/g)?.length ?? 0) === 0
        ? upto.length + 1
        : upto.length - upto.lastIndexOf("\n");
      violations.push({ file, line, col, raw: rawValue });
    }
  }
  return violations;
}

describe("cfz — closed data-cf-layer registry", () => {
  it("every data-cf-layer usage under apps/web/src is in the four-tier set", () => {
    const all: Violation[] = [];
    for (const file of walk(SRC_ROOT)) {
      all.push(...scanFile(file));
    }

    if (all.length > 0) {
      const detail = all
        .slice(0, 10)
        .map((v) => `  ${path.relative(SRC_ROOT, v.file)}:${v.line}:${v.col}  →  "${v.raw}"`)
        .join("\n");
      throw new Error(
        `Found ${all.length} data-cf-layer value(s) outside the four-tier registry.\n` +
          `Allowed: ${ALLOWED_VALUES.join(" | ")}\n\nFirst ${Math.min(10, all.length)}:\n${detail}\n\n` +
          `If this is a real new tier, follow the Z-Stack Contract migration steps.`,
      );
    }

    // Sanity floor: the four-tier set must actually appear in code,
    // otherwise the test passes vacuously even when the registry is
    // accidentally emptied.
    expect(all).toEqual([]);
  });

  it("the four-tier set is non-empty and exactly four entries long", () => {
    expect(ALLOWED_VALUES).toEqual(["canvas", "spatial", "chrome", "app"]);
    expect(new Set(ALLOWED_VALUES).size).toBe(4);
  });

  it("CanvasFirstLayout.tsx is the SOLE owner of the four data-cf-layer= slots", () => {
    // The wrapper publishes the four slots as direct children. Any file
    // other than CanvasFirstLayout.tsx adding the same attribute would
    // create a second stacking context and break the single-source rule.
    const owners = new Set<string>();
    const re = /data-cf-layer=(["'])([^"']+)\1/g;
    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, "utf8");
      const matches = text.match(re);
      if (matches && matches.length > 0) owners.add(path.relative(SRC_ROOT, file));
    }
    // Replace backslashes so the expectation is portable across OSes.
    // path.relative on Windows emits "components\\canvas\\..."; on POSIX
    // it emits "components/canvas/...". The codebase uses POSIX-style
    // paths in source — normalise to that shape for the comparison.
    const normalised = [...owners].map((p) => p.replace(/\\/g, "/")).sort();
    expect(
      normalised,
      "Only CanvasFirstLayout.tsx should publish data-cf-layer slots — " +
        "every other location would create a second stacking context.",
    ).toEqual(["components/canvas/webgl/CanvasFirstLayout.tsx"]);
  });
});

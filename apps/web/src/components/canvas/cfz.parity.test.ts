/*
 * cfz.parity.test.ts — CSS ↔ JS source-of-truth mirror for the SDS z-ladder.
 *
 * The contract is: globals.css is the SOLE source of truth for the four
 * `--cf-z-*` digital tokens. cfz.ts mirrors them into JS so feature
 * modules can read them under SSR / hydration. This test guarantees the
 * mirror never drifts: any change to one without the other fails fast.
 *
 * Together with the existing cfz.test.ts (which asserts the runtime
 * read paths) and the Playwright canvas-first-z-stack.spec.ts (which
 * asserts the resolved DOM matches), this lands the three-way guard:
 *
 *   1. globals.css declares ← source of truth
 *   2. cfz.ts CF_Z_FALLBACK ←          this test
 *   3. Playwright DOM check ←          runtime
 *
 * If any pair drifts, the corresponding guard catches it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CF_Z_FALLBACK, type CfTier } from "./cfz";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// apps/web/src/components/canvas/cfz.parity.test.ts → ../../styles/globals.css
const CSS_PATH = path.join(HERE, "..", "..", "styles", "globals.css");

/**
 * Read globals.css and pull out every `--cf-z-<tier>: <value>;`
 * declaration we can find. Plain regex parse — globals is hand-curated
 * and the four-token block is the only place these names appear, so the
 * regex is intentionally tight.
 */
function parseDeclaredLadder(css: string): Record<CfTier, number> {
  const tiers: CfTier[] = ["canvas", "spatial", "chrome", "app"];
  const out = {} as Record<CfTier, number>;
  for (const tier of tiers) {
    // Tolerates spaces between the colon and the digit. Multi-line
    // declarations are not used for these tokens, so the single-line
    // shape is safe.
    const re = new RegExp(
      `--cf-z-${tier}\\s*:\\s*(-?\\d+)\\s*;`,
    );
    const m = css.match(re);
    expect(
      m,
      `globals.css must declare --cf-z-${tier}: <N>; — found nothing in the source.`,
    ).not.toBeNull();
    out[tier] = Number.parseInt(m![1]!, 10);
  }
  return out;
}

describe("cfz — globals.css ↔ CF_Z_FALLBACK parity", () => {
  it("the four --cf-z-* declarations in globals.css match CF_Z_FALLBACK exactly", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const declared = parseDeclaredLadder(css);

    expect(declared.canvas).toBe(CF_Z_FALLBACK.canvas);
    expect(declared.spatial).toBe(CF_Z_FALLBACK.spatial);
    expect(declared.chrome).toBe(CF_Z_FALLBACK.chrome);
    expect(declared.app).toBe(CF_Z_FALLBACK.app);

    // Catch a single-source drift loudly with one combined assertion.
    expect(declared).toEqual(CF_Z_FALLBACK);
  });

  it("the canonical order canvas < spatial < chrome < app is monotone increasing", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const declared = parseDeclaredLadder(css);
    const ordered: CfTier[] = ["canvas", "spatial", "chrome", "app"];
    for (let i = 1; i < ordered.length; i++) {
      expect(
        declared[ordered[i]!],
        `globals.css ladder regressed between [${ordered[i - 1]}] and [${ordered[i]}]. The four tiers must be strictly monotone.`,
      ).toBeGreaterThan(declared[ordered[i - 1]!]!);
    }
  });

  it("the gaps between rungs are uniform (10 each, matches SDS blueprint)", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const declared = parseDeclaredLadder(css);
    const vals = ["canvas", "spatial", "chrome", "app"].map(
      (k) => declared[k as CfTier],
    );
    const gaps = [vals[1]! - vals[0]!, vals[2]! - vals[1]!, vals[3]! - vals[2]!];
    expect(
      new Set(gaps),
      `The SDS blueprint calls for a uniform 10-unit gap between all four tiers, but globals.css declares [${gaps.join(", ")}].`,
    ).toEqual(new Set([10]));
  });
});

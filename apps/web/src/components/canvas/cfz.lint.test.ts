/*
 * cfz.lint.test.ts — pin for the drei <Html zIndexRange> lint rule.
 *
 * The cuarta (third) `no-restricted-syntax` restriction in
 * eslint.config.mjs forbids raw numeric pairs inside drei
 * `<Html zIndexRange={[N, M]}>`. A future refactor could silently
 * drop it; this test asserts it stays in place by reading the
 * config text and looking for the selector + message markers.
 *
 * Companion to cfz.test.ts (runtime reads), cfz.parity.test.ts
 * (CSS↔JS mirror), cfz.registry.test.ts (closed four-tier
 * registry), and cfz.contract.test.ts (doc↔filesystem).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..", "..", ".."); // 5 ups
const CONFIG_PATH = path.join(ROOT, "eslint.config.mjs");

describe("cfz lint — drei zIndexRange restriction pinned", () => {
  it("eslint.config.mjs declares the drei zIndexRange ladder rule", () => {
    const config = readFileSync(CONFIG_PATH, "utf8");

    // The selector chain (path-level) + the comparator filter that
    // catches numbers but skips the cfZPair kind-name strings.
    expect(
      config,
      "eslint.config.mjs is missing the JSXAttribute name match for zIndexRange.",
    ).toContain(`JSXAttribute[name.name='zIndexRange']`);

    expect(
      config,
      "The drei rule must traverse JSXExpressionContainer → ArrayExpression → Literal.",
    ).toMatch(/JSXExpressionContainer > ArrayExpression > Literal/);

    expect(
      config,
      "The drei rule must filter for numeric values (comparator; the regex form is a known esquery limitation).",
    ).toMatch(/Literal\[value>0\]\[value<1000\]/);

    // The message guides operators to the canonical helper. Spot-check
    // for the cfZPair kind names so future expressiveness edits catch
    // missed updates in the human-readable contract.
    expect(config).toContain("cfZPair(");
    expect(config).toContain("'spatialLabel' | 'spatialAnnotation' | 'chromeChip' | 'chromeZone'");

    // Whole ladder should still be reachable: cfz.ts is the documented
    // upgrade path, and the rule points there.
    expect(config).toMatch(/apps\/web\/src\/components\/canvas\/cfz\.ts/);
  });
});

/**
 * Regression-pin for the four no-restricted-syntax rules that enforce
 * the SDS UI element standards in apps/web/src/components/canvas.
 *
 * Mirrors the cfz.lint.test.ts pattern: parses eslint.config.mjs as a
 * string and asserts the rules exist, with the right severity, scope,
 * and shape. If a future cleanup weakens them (e.g. drops `error`,
 * removes the canvas `files` glob, removes the test-file exclusion),
 * this test fails fast with a precise message.
 *
 * The companion guard is apps/web/src/components/canvas/ui.scan.test.ts
 * which catches the same patterns at vitest time. Together they form
 * a two-tier guard:
 *   - lint (this test pins its existence)   catches drift on save
 *   - scan (vitest fixture in ui.scan.test) catches drift on commit
 *
 * See docs/UI-ELEMENT-STANDARDS.md for the contract.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CONFIG_PATH = "eslint.config.mjs";
const configSrc = readFileSync(CONFIG_PATH, "utf8");

// Slice out the canvas UI-standards block (the one inside the
// "SDS UI element standards enforcement" comment).
function sliceUiStandardsBlock(src: string): string {
  const startMarker = "SDS UI element standards enforcement";
  const start = src.indexOf(startMarker);
  if (start === -1) return "";
  // The block ends at the next top-level rule block (we look for the
  // closing }, then ); to be safe and stop at the array close).
  // It's the second-to-last top-level block in the file, so we
  // locate the trailing `);` of the config and back off.
  const tail = src.lastIndexOf(");");
  return src.slice(start, tail);
}

function rulesInBlock(block: string): string[] {
  // The block contains "rules: { ... }" — extract the inner array form
  // of no-restricted-syntax.
  const m = block.match(/"no-restricted-syntax"\s*:\s*\[([\s\S]*?)\n\s{6}\],/);
  if (!m) return [];
  return m[1]
    .split(/\},\s*\{/)
    .map((s) => "{" + s.trim().replace(/^\{/, "").replace(/\}$/, "") + "}");
}

describe("ui.lint — UI element standards lint rules in eslint.config.mjs", () => {
  const block = sliceUiStandardsBlock(configSrc);
  const rules = rulesInBlock(block);

  it("the canvas UI standards block exists in eslint.config.mjs", () => {
    expect(
      block.includes("SDS UI element standards enforcement"),
      "expected a top-level block with the documented comment marker",
    ).toBe(true);
  });

  it("the block scopes its files to canvas/**/*.ts(x) and excludes .test.* files", () => {
    expect(
      /files\s*:\s*\[[^\]]*canvas\/\*\*\/\*\.[tc]sx[^\]]*\]/.test(block),
      "expected a files: [...] entry that names canvas/**/*.ts/tsx",
    ).toBe(true);
    expect(
      /ignores\s*:\s*\[[^\]]*\*\/\*\.test\.[tc]sx[^\]]*\]/.test(block),
      "expected an ignores: [...] entry that excludes **/*.test.ts and **/*.test.tsx so the scan test's own quoted examples don't trip the rule",
    ).toBe(true);
  });

  it("there are exactly four no-restricted-syntax entries inside the block", () => {
    expect(
      rules.length,
      `expected 4 charted rules (borderRadius, fontSize, gap, rgba), got ${rules.length}`,
    ).toBe(4);
  });

  it("the block is severity 'error' (mirrors cfz lint rule severity)", () => {
    expect(
      /"error"/.test(block),
      "expected the four rules to be at severity 'error', matching the cfz pattern",
    ).toBe(true);
  });

  it("each rule's selector + message references the standards contract doc", () => {
    // Every rule message should cite docs/UI-ELEMENT-STANDARDS.md so
    // the developer who triggers the lint lands one click from context.
    for (const r of rules) {
      expect(
        r.includes("docs/UI-ELEMENT-STANDARDS.md"),
        `expected every rule's message to cite docs/UI-ELEMENT-STANDARDS.md, but got: ${r}`,
      ).toBe(true);
    }
  });

  it("the four rule selectors cover the four dimension scales", () => {
    const must = [
      "borderRadius",
      "fontSize",
      "gap",
      "rgba",
    ];
    for (const substring of must) {
      const found = rules.some((r) => r.includes(substring));
      expect(
        found,
        `expected at least one rule whose selector/message covers ${substring}`,
      ).toBe(true);
    }
  });
});

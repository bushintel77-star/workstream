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
 * See styles/tokens.css for the contract.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CONFIG_PATH = "eslint.config.mjs";
const configSrc = readFileSync(CONFIG_PATH, "utf8");

/**
 * Slice a named selector-set constant, e.g. `const UI_SCALE_SELECTORS = [ … ];`.
 *
 * The selector sets used to be written inline in their config blocks. They were
 * hoisted into named constants on 2026-08-22 because flat config *replaces*
 * same-named rule options instead of merging them, so the canvas block was
 * silently dropping every z-token selector for the one surface they protect.
 * Composing named sets makes the overlap explicit; this test follows.
 */
function sliceSelectorSet(src: string, name: string): string {
  const decl = src.indexOf(`const ${name} = [`);
  if (decl === -1) return "";
  const end = src.indexOf("\n];", decl);
  if (end === -1) return "";
  // Back up over the constant's own JSDoc — that is where the contract marker
  // and the rationale live.
  const doc = src.lastIndexOf("/**", decl);
  return src.slice(doc === -1 ? decl : doc, end);
}

/** Split a selector set into one string per `{ selector, message }` entry. */
function entriesIn(block: string): string[] {
  if (!block) return [];
  return block
    .split(/\n\s{2}\{\n/)
    .slice(1)
    .map((s) => `{${s.replace(/\n\s{2}\},?\s*$/, "")}}`);
}

/** The canvas-scoped config block, which must spread both selector sets. */
function sliceCanvasBlock(src: string): string {
  const start = src.indexOf('files: ["apps/web/src/components/canvas/**/*.ts"');
  if (start === -1) return "";
  const end = src.indexOf("\n  },", start);
  return end === -1 ? "" : src.slice(start, end);
}

describe("ui.lint — UI element standards lint rules in eslint.config.mjs", () => {
  const uiScale = sliceSelectorSet(configSrc, "UI_SCALE_SELECTORS");
  const rules = entriesIn(uiScale);
  const canvasBlock = sliceCanvasBlock(configSrc);

  it("the canvas UI standards selector set exists in eslint.config.mjs", () => {
    expect(
      uiScale.includes("SDS UI element standards enforcement"),
      "expected a UI_SCALE_SELECTORS constant carrying the documented comment marker",
    ).toBe(true);
  });

  it("the canvas block scopes its files to canvas/**/*.ts(x) and excludes .test.* files", () => {
    expect(
      /files\s*:\s*\[[^\]]*canvas\/\*\*\/\*\.[tc]sx[^\]]*\]/.test(canvasBlock),
      "expected a files: [...] entry that names canvas/**/*.ts/tsx",
    ).toBe(true);
    expect(
      /ignores\s*:\s*\[[^\]]*\*\/\*\.test\.[tc]sx[^\]]*\]/.test(canvasBlock),
      "expected an ignores: [...] entry that excludes **/*.test.ts and **/*.test.tsx so the scan test's own quoted examples don't trip the rule",
    ).toBe(true);
  });

  /*
   * The regression this pins: the canvas block must spread BOTH sets. Spreading
   * only UI_SCALE_SELECTORS is what shadowed the z-ladder off canvas/** for
   * every release between the UI-scale block landing and 2026-08-22.
   */
  it("the canvas block spreads the z-token set as well as the UI-scale set", () => {
    expect(
      canvasBlock.includes("...Z_TOKEN_SELECTORS"),
      "canvas must spread Z_TOKEN_SELECTORS — flat config replaces same-named rule options, so omitting it silently drops every z-token selector for canvas/**",
    ).toBe(true);
    expect(
      canvasBlock.includes("...UI_SCALE_SELECTORS"),
      "canvas must spread UI_SCALE_SELECTORS",
    ).toBe(true);
  });

  it("there are exactly four selectors in the UI-scale set", () => {
    expect(
      rules.length,
      `expected 4 charted rules (borderRadius, fontSize, gap, rgba), got ${rules.length}`,
    ).toBe(4);
  });

  it("the canvas block is severity 'error' (mirrors cfz lint rule severity)", () => {
    expect(
      /"error"/.test(canvasBlock),
      "expected the rules to be at severity 'error', matching the cfz pattern",
    ).toBe(true);
  });

  it("each rule's selector + message references the standards contract doc", () => {
    // Every rule message should cite styles/tokens.css so
    // the developer who triggers the lint lands one click from context.
    for (const r of rules) {
      expect(
        r.includes("styles/tokens.css"),
        `expected every rule's message to cite styles/tokens.css, but got: ${r}`,
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

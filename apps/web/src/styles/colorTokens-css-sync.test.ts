import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PALETTE } from "./colorTokens";

/**
 * Drift guard — the TS mirror must stay identical to color-tokens.css.
 * The mirror diverged silently before (proposedStroke drifted to cobalt-d-500
 * while the CSS spec said Signal Blue). This test parses the CSS source of
 * truth and fails on any mismatch or missing declaration.
 */

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "color-tokens.css"),
  "utf8",
);

/** All `--name: value;` declarations from the file, value before any comment. */
const declarations = new Map<string, string>();
for (const match of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  const value = match[2].replace(/\/\*.*?\*\//g, "").trim();
  if (!declarations.has(match[1])) declarations.set(match[1], value);
}

function kebab(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

/** TS keys whose CSS declaration is gs-prefixed rather than bare kebab-case. */
const GS_PREFIXED = new Set([
  "sunWarm", "skyCool", "foliageTint", "groundOlive", "groundBounce",
  "ambientCool", "rimCool", "windowGlow", "bark", "concrete", "anodizedMetal",
  "timberWeathered", "ledWarm", "summerGreen", "autumnOrange", "cadWater",
  "cadElectric", "cadSewer", "cadGas", "cadComms", "cadReclaimed", "sketchInk",
]);

/** TS keys with no single CSS counterpart (TS-only derivations). */
const TS_ONLY = new Set(["draftingGrey", "warningL500", "warningD400", "gsConflictInk"]);

describe("colorTokens ↔ color-tokens.css sync", () => {
  it("mirrors every palette entry to an identical CSS declaration", () => {
    const mismatches: string[] = [];
    for (const [key, tsValue] of Object.entries(PALETTE)) {
      if (TS_ONLY.has(key)) continue;
      const cssName = key === "renderBlueprintGround"
        ? "gs-blueprint-ground"
        : GS_PREFIXED.has(key)
          ? `gs-${kebab(key)}`
          : kebab(key);
      const cssValue = declarations.get(cssName);
      if (cssValue === undefined) {
        mismatches.push(`${key}: no --${cssName} declaration in color-tokens.css`);
        continue;
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(cssValue)) {
        mismatches.push(`${key}: --${cssName} is not a plain hex (${cssValue})`);
        continue;
      }
      if (cssValue.toLowerCase() !== tsValue.toLowerCase()) {
        mismatches.push(`${key}: TS ${tsValue} ≠ CSS ${cssValue}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("defines the doc §1.3 ink names the codebase references", () => {
    // The historical bug: components referenced --gs-ink-truth which was
    // never defined. These three must always exist with real values.
    for (const name of ["gs-ink-truth", "gs-ink-primary", "gs-ink-conflict"]) {
      expect(declarations.get(name), `--${name} must be defined`).toBeDefined();
    }
  });

  it("defines the Studio Paper depth law tokens", () => {
    for (const name of [
      "gs-panel", "gs-panel-grad", "gs-panel-frost", "gs-frost-blur",
      "gs-shadow-1", "gs-shadow-2", "gs-shadow-3", "gs-shadow-4",
      "gs-chip-active", "gs-chip-active-ink",
      "gs-line-strong", "gs-primary-ink", "gs-earthworks-fill",
    ]) {
      expect(declarations.get(name), `--${name} must be defined`).toBeDefined();
    }
  });
});

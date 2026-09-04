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

const here = dirname(fileURLToPath(import.meta.url));
// The drawing palette lives in the design system (tokens.css); the legacy
// namespaces (--gray-l-*, --hc-*, --surface-*) are still in color-tokens.css.
// Both are parsed so a mirrored entry can resolve from either.
const css = [
  readFileSync(resolve(here, "tokens.css"), "utf8"),
  readFileSync(resolve(here, "color-tokens.css"), "utf8"),
].join("\n");

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

/**
 * Scene/material keys and the drawing token each mirrors.
 *
 * These are the values the WebGL scene paints with, so the mirror drifting
 * from the CSS means the 3D scene and the DOM disagree about what "gas" or
 * "bark" looks like. Stated explicitly rather than derived by kebab-casing:
 * the one-system rebuild renamed several (foliage-tint -> foliage,
 * anodized-metal -> metal, cad-water -> water), and a naming rule that has
 * to encode its own exceptions is not a rule.
 */
const SCENE_TOKEN: Record<string, string> = {
  sunWarm: "ws-dwg-sun-warm",
  skyCool: "ws-dwg-sky-cool",
  foliageTint: "ws-dwg-foliage",
  groundOlive: "ws-dwg-ground-olive",
  groundBounce: "ws-dwg-ground-bounce",
  ambientCool: "ws-dwg-ambient-cool",
  rimCool: "ws-dwg-rim-cool",
  windowGlow: "ws-dwg-window-glow",
  bark: "ws-dwg-bark",
  concrete: "ws-dwg-concrete",
  anodizedMetal: "ws-dwg-metal",
  timberWeathered: "ws-dwg-timber",
  ledWarm: "ws-dwg-led-warm",
  summerGreen: "ws-dwg-summer",
  autumnOrange: "ws-dwg-autumn",
  cadWater: "ws-dwg-water",
  cadElectric: "ws-dwg-electric",
  cadSewer: "ws-dwg-sewer",
  cadGas: "ws-dwg-gas",
  cadComms: "ws-dwg-comms",
  cadReclaimed: "ws-dwg-reclaimed",
  sketchInk: "ws-dwg-sketch",
  renderBlueprintGround: "ws-dwg-blueprint",
  gsCanvas: "ws-canvas",
  gsInkStrong: "ws-ink",
  gsInkSecondary: "ws-ink-secondary",
  gsInkMuted: "ws-ink-muted",
  gsChipActive: "ws-active",
  gsChipActiveInk: "ws-active-ink",
  gsConflict: "ws-conflict",
  gsPrimary: "ws-active",
  gsPrimaryInk: "ws-active",
  gsEarthworksFill: "ws-dwg-fill",
  gsShadow: "ws-canvas",
};

/** TS keys with no single CSS counterpart (TS-only derivations). */
const TS_ONLY = new Set(["draftingGrey", "warningL500", "warningD400", "gsConflictInk"]);

/**
 * Dark-studio scene/DOM splits (DESIGN.md §2, 2026-08-26): the TS mirror
 * feeds the WebGL SCENE (ink, hairlines and boundaries render over the
 * dark canvas/panel chassis), while the CSS values serve DOM chrome —
 * which is still Studio Paper where it matters (--ws-panel is a
 * white gradient, so DOM ink stays charcoal). The two media legitimately
 * differ for these keys; every other entry must stay byte-identical.
 * Scene-side AA for the split keys is asserted in colorTokens.test.ts.
 */
const DARK_STUDIO_SCENE_SPLIT = new Set(["gsInk", "gsLine", "gsLineStrong", "gsPanel"]);

describe("colorTokens ↔ color-tokens.css sync", () => {
  it("mirrors every palette entry to an identical CSS declaration", () => {
    const mismatches: string[] = [];
    for (const [key, tsValue] of Object.entries(PALETTE)) {
      if (TS_ONLY.has(key)) continue;
      if (DARK_STUDIO_SCENE_SPLIT.has(key)) continue; // declared split — see above
      const cssName = SCENE_TOKEN[key] ?? kebab(key);
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

  it("declares every chrome role the system promises", () => {
    // The historical bug this guards: components referenced an ink token that
    // was never declared anywhere, so it only ever resolved through a
    // fallback — 37 such dead references were found during the rebuild.
    for (const name of [
      "ws-canvas", "ws-panel", "ws-panel-raised", "ws-panel-sunken",
      "ws-line", "ws-line-soft", "ws-line-strong",
      "ws-ink", "ws-ink-secondary", "ws-ink-muted", "ws-ink-disabled",
      "ws-active", "ws-active-ink", "ws-focus",
      "ws-conflict", "ws-warning", "ws-success",
      "ws-shadow-1", "ws-shadow-2",
    ]) {
      expect(declarations.get(name), `--${name} must be defined`).toBeDefined();
    }
  });

  it("keeps colour out of the chrome zone", () => {
    // The rule the whole system hangs off: a landscape plan is a colour
    // document, so chrome that carries a hue competes with the drawing.
    // The sole exception is --ws-ai-run (bright yellow brutalist switch).
    const chromeSurfaces = [
      "ws-canvas", "ws-panel", "ws-panel-raised", "ws-panel-sunken",
      "ws-ink", "ws-ink-secondary", "ws-ink-muted", "ws-active",
    ];
    const chromatic: string[] = [];
    for (const name of chromeSurfaces) {
      const hex = declarations.get(name);
      const m = hex?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (!m) continue;
      const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
      // Near-neutral: no channel more than 12/255 from the mean.
      const mean = (r + g + b) / 3;
      if (Math.max(Math.abs(r - mean), Math.abs(g - mean), Math.abs(b - mean)) > 12) {
        chromatic.push(`--${name} (${hex}) carries a hue`);
      }
    }
    expect(chromatic).toEqual([]);
  });
});

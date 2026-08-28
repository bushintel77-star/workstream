import { describe, expect, it } from "vitest";
import {
  PALETTE,
  SEMANTIC,
  SEMANTIC_DARK,
  SEMANTIC_LIGHT,
  semanticForTheme,
} from "./colorTokens";

/** Relative luminance for WCAG contrast (sRGB). */
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: string, b: string): number {
  const L1 = lum(a);
  const L2 = lum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Studio Paper surfaces — every surface ink can land on (TOKENS.md §4). */
const PANEL = "#FFFFFF";
const CANVAS = "#F4F4F4";
const SUNKEN = "#EBEBEB";
const PRESSED = "#E4E4E4";

describe("colorTokens — Studio Paper", () => {
  it("is a single theme: light/dark exports resolve to the same set", () => {
    expect(SEMANTIC_LIGHT).toBe(SEMANTIC);
    expect(SEMANTIC_DARK).toBe(SEMANTIC);
    expect(semanticForTheme(false)).toBe(SEMANTIC);
    expect(semanticForTheme(true)).toBe(SEMANTIC);
  });

  it("keeps deliberate stroke ≠ text pairs for existing/proposed labels", () => {
    expect(SEMANTIC.existingStroke).not.toBe(SEMANTIC.existingText);
    expect(SEMANTIC.proposedStroke).not.toBe(SEMANTIC.proposedText);
    // Planting may share stroke/text on paper — dark greens are AA text
    // directly (no dark-era lifted stops needed). Assert the pair reads:
    expect(contrast(SEMANTIC.plantingRetainText, CANVAS)).toBeGreaterThan(4.5);
  });

  it("meets AA (4.5:1) for every ink tier on every paper surface", () => {
    const surfaces = [PANEL, CANVAS, SUNKEN, PRESSED];
    // Paper inks — DOM chrome stays Studio Paper (--gs-panel-grad is a
    // white gradient), so these must read on every light surface.
    const inks = [
      PALETTE.gsInkStrong,
      PALETTE.gsInkSecondary,
      PALETTE.gsInkMuted,
      SEMANTIC.textPrimary,
      SEMANTIC.textSecondary,
      SEMANTIC.textMuted,
    ];
    for (const ink of inks) {
      for (const surface of surfaces) {
        expect(contrast(ink, surface)).toBeGreaterThan(4.5);
      }
    }
  });

  it("meets AA for the scene ink over the dark studio chassis", () => {
    // gsInk is the SCENE value (white over the dark WebGL canvas — the
    // dotted ground and sketch ink read it); the DOM paper ink is
    // --gs-ink in color-tokens.css. Dark-studio split: DESIGN.md §2.
    for (const surface of [PALETTE.gsCanvas, PALETTE.gsPanel]) {
      expect(contrast(PALETTE.gsInk, surface)).toBeGreaterThan(4.5);
    }
  });

  it("meets AA for blue primary + crimson conflict roles", () => {
    // Primary CTA must carry white text (DeepSeek-family blue)
    expect(contrast("#FFFFFF", PALETTE.gsPrimary)).toBeGreaterThan(4.5);
    // Primary blue as text on every paper surface
    for (const surface of [PANEL, CANVAS, SUNKEN, PRESSED]) {
      expect(contrast(PALETTE.gsPrimaryInk, surface)).toBeGreaterThan(4.5);
    }
    // Conflict/strike fill must carry white text (crimson, conflict-only)
    expect(contrast("#FFFFFF", PALETTE.gsConflict)).toBeGreaterThan(4.5);
  });

  it("meets AA for charcoal selection chips (15.8:1 class)", () => {
    expect(contrast(PALETTE.gsChipActiveInk, PALETTE.gsChipActive)).toBeGreaterThan(4.5);
  });

  it("meets non-text 3:1 for geometry data strokes on paper", () => {
    expect(contrast(SEMANTIC.proposedStroke, CANVAS)).toBeGreaterThan(3);
    expect(contrast(SEMANTIC.existingStroke, CANVAS)).toBeGreaterThan(3);
    expect(contrast(SEMANTIC.plantingRetainStroke, CANVAS)).toBeGreaterThan(3);
    expect(PALETTE.forestD550).toBe("#328052");
  });

  it("meets non-text 3:1 for interactive boundaries and focus ring", () => {
    expect(contrast(PALETTE.gsLineStrong, PANEL)).toBeGreaterThan(3);
    expect(contrast(PALETTE.gsPrimary, PANEL)).toBeGreaterThan(3);
  });

  it("keeps the neutral ramp dead-neutral (R=G=B on every stop)", () => {
    for (const hex of [
      PALETTE.grayL0, PALETTE.grayL25, PALETTE.grayL50, PALETTE.grayL100,
      PALETTE.grayL150, PALETTE.grayL200, PALETTE.grayL300, PALETTE.grayL400,
      PALETTE.grayL500, PALETTE.grayL700, PALETTE.grayL800, PALETTE.grayL900,
    ]) {
      const h = hex.replace("#", "");
      expect(h.slice(0, 2), `${hex} must be neutral`).toBe(h.slice(4, 6));
      expect(h.slice(2, 4), `${hex} must be neutral`).toBe(h.slice(4, 6));
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  PALETTE,
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

describe("colorTokens v2", () => {
  it("keeps dark stroke ≠ text (AA text uses lifted stop)", () => {
    expect(SEMANTIC_DARK.existingStroke).not.toBe(SEMANTIC_DARK.existingText);
    expect(SEMANTIC_DARK.proposedStroke).not.toBe(SEMANTIC_DARK.proposedText);
    expect(SEMANTIC_DARK.plantingRetainStroke).not.toBe(
      SEMANTIC_DARK.plantingRetainText,
    );
  });

  it("meets AA text contrast for light semantic text on canvas", () => {
    const c = SEMANTIC_LIGHT.canvas;
    expect(contrast(SEMANTIC_LIGHT.textPrimary, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_LIGHT.existingText, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_LIGHT.proposedText, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_LIGHT.plantingRetainText, c)).toBeGreaterThan(4.5);
  });

  it("meets AA text contrast for dark *-text on canvas", () => {
    const c = SEMANTIC_DARK.canvas;
    expect(contrast(SEMANTIC_DARK.textPrimary, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_DARK.existingText, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_DARK.proposedText, c)).toBeGreaterThan(4.5);
    expect(contrast(SEMANTIC_DARK.plantingRetainText, c)).toBeGreaterThan(4.5);
  });

  it("meets UI 3:1 for dark planting-retain stroke (bumped forest-d-550)", () => {
    expect(
      contrast(SEMANTIC_DARK.plantingRetainStroke, SEMANTIC_DARK.canvas),
    ).toBeGreaterThan(3);
    expect(PALETTE.forestD550).toBe("#328052");
  });

  it("semanticForTheme switches light/dark", () => {
    expect(semanticForTheme(false)).toBe(SEMANTIC_LIGHT);
    expect(semanticForTheme(true)).toBe(SEMANTIC_DARK);
  });
});

import { describe, expect, it } from "vitest";
import {
  CANVAS_GROUND_FALLBACK,
  canvasGroundColor,
  contrastRatio,
  contrastReadout,
  relativeLuminance,
} from "./materialContrast";

describe("relativeLuminance", () => {
  it("computes exact WCAG luminance for the hex extremes", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("parses oklch through OKLab → linear sRGB", () => {
    // oklch(1 0 0) is white by definition (L=1, no chroma).
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 3);
    // oklch(0 0 0) is black.
    expect(relativeLuminance("oklch(0 0 0)")).toBeCloseTo(0, 3);
    // A mid-lightness neutral sits between the extremes — the palette's
    // materials all live in this band (L 0.33–0.88).
    const mid = relativeLuminance("oklch(0.5 0 0)");
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.3);
  });

  it("returns a neutral mid-grey for unparseable input (finite, not confident)", () => {
    expect(relativeLuminance("not-a-colour")).toBe(0.5);
  });
});

describe("contrastRatio", () => {
  it("black on white is exactly 21:1, same colour is 1:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#3B3B3B", "#3B3B3B")).toBe(1);
  });

  it("drafting ink reads strongly on the dark canvas ground", () => {
    // Hand-checked: #f2f0ea (Y≈0.87) vs #0d0f11 (Y≈0.0047) ≈ 16.8.
    const ratio = contrastRatio("#f2f0ea", CANVAS_GROUND_FALLBACK);
    expect(ratio).toBeGreaterThan(15);
    expect(ratio).toBeLessThan(18);
  });

  it("is symmetric — (a,b) equals (b,a)", () => {
    expect(
      contrastRatio("oklch(0.48 0.11 145)", CANVAS_GROUND_FALLBACK),
    ).toBe(contrastRatio(CANVAS_GROUND_FALLBACK, "oklch(0.48 0.11 145)"));
  });

  it("rounds to the one decimal the readout shows", () => {
    const ratio = contrastRatio("oklch(0.74 0.055 145)", "#ffffff");
    expect(Number.isInteger(ratio * 10)).toBe(true);
  });
});

describe("readout + ground resolution", () => {
  it("formats the ratio with the :1 suffix", () => {
    expect(contrastReadout("#ffffff", "#000000")).toBe("21:1");
  });

  it("falls back to the canvas token value when the sheet is unreachable", () => {
    expect(canvasGroundColor(undefined)).toBe("#0d0f11");
    expect(
      canvasGroundColor({ getPropertyValue: () => "  " }),
    ).toBe("#0d0f11");
  });

  it("prefers the live token over the fallback", () => {
    expect(
      canvasGroundColor({ getPropertyValue: () => " #123456 " }),
    ).toBe("#123456");
  });
});

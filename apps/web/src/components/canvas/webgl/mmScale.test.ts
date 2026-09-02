import { describe, expect, it } from "vitest";
import { mmAtScaleToPx, mmToPx } from "./mmScale";

describe("mmToPx — weight at issued scale (3.5)", () => {
  it("ports the design formula verbatim", () => {
    // mm/25.4 in × 96 dpi × (200/scale).
    expect(mmToPx(0.5, 200)).toBeCloseTo((0.5 / 25.4) * 96 * 1, 8);
    expect(mmToPx(1, 200)).toBeCloseTo((1 / 25.4) * 96, 8);
    expect(mmToPx(0.5, 100)).toBeCloseTo((0.5 / 25.4) * 96 * 2, 8);
  });

  it("a 0.5mm line renders at 0.5mm at 1:200", () => {
    // Round-trip honesty: px → mm at the same scale returns the weight.
    const px = mmAtScaleToPx(0.5);
    const mm = (px / 96) * 25.4;
    expect(mm).toBeCloseTo(0.5, 8);
  });

  it("scales px inversely with the denominator (zoom-consistent weight)", () => {
    expect(mmToPx(0.5, 400)).toBeCloseTo(mmToPx(0.5, 200) / 2, 8);
  });
});

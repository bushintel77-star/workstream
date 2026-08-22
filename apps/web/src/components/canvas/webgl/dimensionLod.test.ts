import { describe, expect, it } from "vitest";
import {
  BEARING_CHIP_WIDTH_SCALE,
  DIM_BOX_MAX_HALF_W,
  DIM_BOX_MIN_HALF_W,
  dimDeclutterBoxForZoom,
  estimateDimChipRect,
} from "./dimensionLod";

describe("dimDeclutterBoxForZoom", () => {
  it("matches the classic default at plan-fit zoom 1", () => {
    const box = dimDeclutterBoxForZoom(1);
    expect(box.halfWPct).toBeCloseTo(4.03);
    expect(box.halfHPct).toBeCloseTo(1.1);
  });

  it("shrinks the box as zoom increases (labels reappear) until the clamp", () => {
    const z1 = dimDeclutterBoxForZoom(1);
    const z2 = dimDeclutterBoxForZoom(2);
    const z3 = dimDeclutterBoxForZoom(3);
    expect(z2.halfWPct).toBeLessThan(z1.halfWPct);
    expect(z3.halfWPct).toBeLessThan(z2.halfWPct);
    expect(z3.halfHPct).toBeLessThan(z2.halfHPct);
  });

  it("saturates at the classic minimum box past the clamp floor", () => {
    const z5 = dimDeclutterBoxForZoom(5);
    const z20 = dimDeclutterBoxForZoom(20);
    expect(z5.halfWPct).toBe(DIM_BOX_MIN_HALF_W);
    expect(z20.halfWPct).toBe(DIM_BOX_MIN_HALF_W);
  });

  it("clamps at the classic limits so overview never empties the ring", () => {
    expect(dimDeclutterBoxForZoom(0.1).halfWPct).toBe(DIM_BOX_MAX_HALF_W);
    expect(dimDeclutterBoxForZoom(100).halfWPct).toBe(DIM_BOX_MIN_HALF_W);
  });

  it("falls back to plan-fit on degenerate zoom", () => {
    expect(dimDeclutterBoxForZoom(Number.NaN).halfWPct).toBeCloseTo(4.03);
    expect(dimDeclutterBoxForZoom(Number.POSITIVE_INFINITY).halfWPct).toBeCloseTo(
      4.03,
    );
  });

  describe("bearing chip width", () => {
    it("widens the box for the longer key + bearing + distance chip", () => {
      const plain = dimDeclutterBoxForZoom(1);
      const wide = dimDeclutterBoxForZoom(1, BEARING_CHIP_WIDTH_SCALE);
      expect(wide.halfWPct).toBeCloseTo(plain.halfWPct * BEARING_CHIP_WIDTH_SCALE);
      // Height is unchanged — the bearing joins the same single line.
      expect(wide.halfHPct).toBeCloseTo(plain.halfHPct);
    });

    it("scales past the clamp ceiling instead of saturating under it", () => {
      // Applying the multiplier before the clamps would cap a wide chip at
      // DIM_BOX_MAX_HALF_W and silently under-declutter at overview zoom.
      const wide = dimDeclutterBoxForZoom(0.1, BEARING_CHIP_WIDTH_SCALE);
      expect(wide.halfWPct).toBeGreaterThan(DIM_BOX_MAX_HALF_W);
    });

    it("keeps the zoom monotonicity under scaling", () => {
      const z1 = dimDeclutterBoxForZoom(1, BEARING_CHIP_WIDTH_SCALE);
      const z2 = dimDeclutterBoxForZoom(2, BEARING_CHIP_WIDTH_SCALE);
      expect(z2.halfWPct).toBeLessThan(z1.halfWPct);
    });

    it("ignores a degenerate scale", () => {
      expect(dimDeclutterBoxForZoom(1, 0).halfWPct).toBeCloseTo(4.03);
      expect(dimDeclutterBoxForZoom(1, Number.NaN).halfWPct).toBeCloseTo(4.03);
    });
  });
});

describe("estimateDimChipRect", () => {
  it("centres the estimated box on the projected anchor", () => {
    const rect = estimateDimChipRect("B7 · 48.20 m", 400, 300);
    expect(rect.x + rect.width / 2).toBeCloseTo(400);
    expect(rect.y + rect.height / 2).toBeCloseTo(300);
  });

  it("grows with the text, so a bearing chip reserves more than a plain one", () => {
    const plain = estimateDimChipRect("B7 · 48.20 m", 0, 0);
    const withBearing = estimateDimChipRect("B7 · S85°25'26\"W · 48.20 m", 0, 0);
    expect(withBearing.width).toBeGreaterThan(plain.width);
  });

  it("never estimates a degenerate box", () => {
    const rect = estimateDimChipRect("", 0, 0);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });
});

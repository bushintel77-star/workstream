import { describe, expect, it } from "vitest";
import {
  DIM_BOX_MAX_HALF_W,
  DIM_BOX_MIN_HALF_W,
  dimDeclutterBoxForZoom,
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
});

import { describe, expect, it } from "vitest";
import {
  assertFits,
  cadPackBottomClearance,
  CANONICAL_SCREEN,
  groups,
  packs,
  ribbonHeight,
} from "./tradePacks";

describe("trade packs — ribbon height budget (4.3 / 4.4)", () => {
  it("the full CAD pack is five groups of 12 tools", () => {
    expect(packs.cad).toEqual(["DRAW", "GRADE", "PLANT", "BUILD", "MEASURE"]);
    const tiles = packs.cad.reduce(
      (n, g) => n + groups[g].length,
      0,
    );
    expect(tiles).toBe(12);
  });

  it("assertFits passes the canonical 1194×834 viewport for every pack", () => {
    for (const pack of Object.keys(packs)) {
      expect(() =>
        assertFits(pack as keyof typeof packs, CANONICAL_SCREEN.h),
      ).not.toThrow();
    }
  });

  it("assertFits names the px overflow when a pack is over budget", () => {
    expect(() => assertFits("cad", 400)).toThrow(/over budget/);
    expect(() => assertFits("cad", 400)).toThrow(/px/);
  });

  it("canonical measurement: CAD pack ends ≥74px clear of the bottom (4.4)", () => {
    // Design canonical: ≥74px clear of the bottom edge / ≥52px clear of the
    // 22px-inset track on 1194×834. Budget math must reproduce the REAL DOM
    // (measured 703px ribbon at top 30 → 101px clear).
    const clearance = cadPackBottomClearance(CANONICAL_SCREEN.h);
    expect(clearance).toBeGreaterThanOrEqual(74);
    const trackClearance = clearance - 22;
    expect(trackClearance).toBeGreaterThanOrEqual(52);
    expect(ribbonHeight("cad")).toBe(703);
  });

  it("civil pack (SERVICE + WATER) is taller than cad and still fits", () => {
    expect(ribbonHeight("civil")).toBeGreaterThan(ribbonHeight("cad"));
    expect(() =>
      assertFits("civil", CANONICAL_SCREEN.h),
    ).not.toThrow();
  });
});

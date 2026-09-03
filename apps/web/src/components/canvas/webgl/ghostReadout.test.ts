import { describe, expect, it } from "vitest";
import { ghostReadout, ghostCoordinate, ghostWouldConflict } from "./ghostReadout";
import type { BentoTile } from "./assetBento";

function makeTile(category: BentoTile["category"], spreadM?: number, heightM?: number): BentoTile {
  return {
    symbolId: "test",
    label: "Test",
    category,
    spreadM,
    heightM,
    planGlyph: "\u2660",
    elevGlyph: "\u2663",
    hero: false,
  };
}

describe("ghostReadout — Phase M.7", () => {
  describe("ghostReadout", () => {
    it("formats full readout with dimensions", () => {
      const tile = makeTile("CANOPY", 9.0, 14.0);
      expect(ghostReadout("GRD", 74.2, 51.8, tile)).toBe(
        "GRD \u00b7 spread 9.0m \u00b7 ht 14.0m \u00b7 E 74.2 N 51.8",
      );
    });

    it("formats readout without dimensions", () => {
      expect(ghostReadout("GRD", 0, 0, undefined)).toBe("GRD \u00b7 E 0.0 N 0.0");
    });

    it("formats readout for non-GRD plane", () => {
      const tile = makeTile("SHRUB", 1.2);
      expect(ghostReadout("PLT", -12.5, 3.7, tile)).toBe(
        "PLT \u00b7 spread 1.2m \u00b7 E -12.5 N 3.7",
      );
    });

    it("rounds to 1 decimal place", () => {
      expect(ghostReadout("GRD", 74.23456, 51.899, undefined)).toBe(
        "GRD \u00b7 E 74.2 N 51.9",
      );
    });
  });

  describe("ghostCoordinate", () => {
    it("formats E/N only", () => {
      expect(ghostCoordinate(74.2, 51.8)).toBe("E 74.2 N 51.8");
    });

    it("handles negative coordinates", () => {
      expect(ghostCoordinate(-25.0, -3.14)).toBe("E -25.0 N -3.1");
    });
  });

  describe("ghostWouldConflict", () => {
    it("returns false when no existing placements", () => {
      expect(ghostWouldConflict(0, 0, 4.5, [])).toBe(false);
    });

    it("returns true when rings overlap", () => {
      const existing = [{ x: 5, z: 0, radiusM: 4.5 }];
      expect(ghostWouldConflict(0, 0, 4.5, existing)).toBe(true);
    });

    it("returns false when rings are apart", () => {
      const existing = [{ x: 20, z: 0, radiusM: 4.5 }];
      expect(ghostWouldConflict(0, 0, 4.5, existing)).toBe(false);
    });

    it("respects clearance margin", () => {
      // Two 1m radius rings 3m apart: dist=3, r1+r2+clearance=2.4 => 3 > 2.4, no conflict
      const far = [{ x: 3, z: 0, radiusM: 1 }];
      expect(ghostWouldConflict(0, 0, 1, far, 0.4)).toBe(false);
      // Two 1m radius rings 2m apart: dist=2, r1+r2+clearance=2.4 => 2 < 2.4, conflict
      const near = [{ x: 2, z: 0, radiusM: 1 }];
      expect(ghostWouldConflict(0, 0, 1, near, 0.4)).toBe(true);
    });
  });
});

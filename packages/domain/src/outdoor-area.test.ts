import { describe, expect, it } from "vitest";
import { outdoorDifferenceM2, planarPolyArea } from "./outdoor-area";

/** 20×20 m square lot. */
const LOT: [number, number][] = [
  [0, 0],
  [20, 0],
  [20, 20],
  [0, 20],
];

describe("outdoorDifferenceM2", () => {
  it("matches naive subtraction when the building sits fully inside", () => {
    const house: [number, number][] = [
      [5, 5],
      [15, 5],
      [15, 12],
      [5, 12],
    ];
    const r = outdoorDifferenceM2(LOT, [house]);
    expect(r.areaM2).toBeCloseTo(r.naiveAreaM2, 5);
    expect(r.differsFromNaive).toBe(false);
    expect(r.areaM2).toBeCloseTo(400 - 70, 5);
  });

  it("differs from naive when the building overhangs the lot", () => {
    // 10×10 house straddling the east boundary — half outside the lot.
    const overhang: [number, number][] = [
      [15, 5],
      [25, 5],
      [25, 15],
      [15, 15],
    ];
    const r = outdoorDifferenceM2(LOT, [overhang]);
    // Intersection is 5×10 = 50 m² → outdoor boolean = 350.
    // Naive subtracts full 100 m² house → 300.
    expect(r.areaM2).toBeCloseTo(350, 0);
    expect(r.naiveAreaM2).toBeCloseTo(300, 0);
    expect(r.differsFromNaive).toBe(true);
  });

  it("returns the full lot when no buildings", () => {
    const r = outdoorDifferenceM2(LOT, []);
    expect(r.areaM2).toBeCloseTo(400, 5);
    expect(r.polygons).toHaveLength(1);
  });
});

describe("planarPolyArea", () => {
  it("shoelace on a unit square", () => {
    expect(
      planarPolyArea([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBeCloseTo(1, 8);
  });
});

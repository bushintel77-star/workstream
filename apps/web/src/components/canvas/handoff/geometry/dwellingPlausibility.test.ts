import { describe, expect, it } from "vitest";
import {
  dwellingCoverageFrac,
  isDwellingPlausibleOnLot,
  rejectOversizedDwelling,
} from "./dwellingPlausibility";
import type { PctPoint } from "./types";

const lot: PctPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("dwellingPlausibility", () => {
  it("accepts a house that covers a modest fraction of the lot", () => {
    const house: PctPoint[] = [
      { x: 20, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 50 },
      { x: 20, y: 50 },
    ];
    expect(dwellingCoverageFrac(lot, house)).toBeCloseTo(0.09, 2);
    expect(isDwellingPlausibleOnLot(lot, house)).toBe(true);
    expect(rejectOversizedDwelling(lot, house)).toEqual(house);
  });

  it("rejects a dwelling larger than 80% of the lot (9898-on-3810 class)", () => {
    // House almost fills the board — classic Vicmap INTERSECTS overhang.
    const house: PctPoint[] = [
      { x: 2, y: 2 },
      { x: 98, y: 2 },
      { x: 98, y: 98 },
      { x: 2, y: 98 },
    ];
    expect(dwellingCoverageFrac(lot, house)).toBeGreaterThan(0.8);
    expect(isDwellingPlausibleOnLot(lot, house)).toBe(false);
    expect(rejectOversizedDwelling(lot, house)).toEqual([]);
  });

  it("treats an empty building as plausible", () => {
    expect(isDwellingPlausibleOnLot(lot, [])).toBe(true);
  });
});

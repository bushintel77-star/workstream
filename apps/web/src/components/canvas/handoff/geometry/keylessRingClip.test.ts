import { describe, expect, it } from "vitest";
import {
  filterKeylessRingsToBoard,
  isAuthorityScaleKeylessRing,
  keylessRingHitsBoard,
  shouldPaintKeylessFill,
} from "./keylessRingClip";

const LOT: Array<{ x_pct: number; y_pct: number }> = [
  { x_pct: 20, y_pct: 20 },
  { x_pct: 80, y_pct: 20 },
  { x_pct: 80, y_pct: 80 },
  { x_pct: 20, y_pct: 80 },
];

/** Water-corp district projected through parcel letterbox. */
const AUTHORITY: Array<{ x_pct: number; y_pct: number }> = [
  { x_pct: -400, y_pct: -350 },
  { x_pct: 520, y_pct: -350 },
  { x_pct: 520, y_pct: 480 },
  { x_pct: -400, y_pct: 480 },
];

describe("keylessRingClip", () => {
  it("detects board hit for lot-local rings", () => {
    expect(keylessRingHitsBoard(LOT)).toBe(true);
    expect(isAuthorityScaleKeylessRing(LOT)).toBe(false);
    expect(shouldPaintKeylessFill("flood", LOT)).toBe(true);
  });

  it("never hatch-fills water_corp / road_casement (district = chip only)", () => {
    expect(shouldPaintKeylessFill("water_corp", AUTHORITY)).toBe(false);
    expect(shouldPaintKeylessFill("water_corp", LOT)).toBe(false);
    expect(shouldPaintKeylessFill("road_casement", LOT)).toBe(false);
  });

  it("flags authority-scale planning; hazards may fill when lot-clipped", () => {
    expect(keylessRingHitsBoard(AUTHORITY)).toBe(true);
    expect(isAuthorityScaleKeylessRing(AUTHORITY)).toBe(true);
    expect(shouldPaintKeylessFill("planning", AUTHORITY)).toBe(false);
    expect(shouldPaintKeylessFill("planning", LOT)).toBe(true);
    expect(shouldPaintKeylessFill("flood", AUTHORITY)).toBe(true);
    expect(shouldPaintKeylessFill("bushfire", AUTHORITY)).toBe(true);
  });

  it("rejects rings that miss the board entirely", () => {
    const far = [
      { x_pct: 200, y_pct: 200 },
      { x_pct: 300, y_pct: 200 },
      { x_pct: 300, y_pct: 300 },
    ];
    expect(keylessRingHitsBoard(far)).toBe(false);
    expect(shouldPaintKeylessFill("flood", far)).toBe(false);
    expect(filterKeylessRingsToBoard([LOT, far])).toEqual([LOT]);
  });
});

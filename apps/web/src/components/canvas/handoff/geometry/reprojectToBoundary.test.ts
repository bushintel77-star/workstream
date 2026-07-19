import { describe, expect, it } from "vitest";
import {
  reprojectDocToBoundary,
  reprojectPointFromRing,
} from "./reprojectToBoundary";

const seedLot = [
  { x: 30, y: 20 },
  { x: 50, y: 20 },
  { x: 48, y: 80 },
  { x: 32, y: 80 },
];

const vicmapLot = [
  { x: 40, y: 10 },
  { x: 70, y: 12 },
  { x: 68, y: 90 },
  { x: 38, y: 88 },
];

describe("reprojectPointFromRing", () => {
  it("maps the centre of the old lot to the centre of the new lot", () => {
    const p = reprojectPointFromRing({ x: 40, y: 50 }, seedLot, vicmapLot);
    expect(p.x).toBeGreaterThan(50);
    expect(p.x).toBeLessThan(60);
    expect(p.y).toBeGreaterThan(40);
    expect(p.y).toBeLessThan(60);
  });
});

describe("reprojectDocToBoundary", () => {
  it("moves building and items with the parcel snap", () => {
    const next = reprojectDocToBoundary(
      {
        boundary: seedLot,
        building: [
          { x: 36, y: 35 },
          { x: 44, y: 35 },
          { x: 44, y: 55 },
          { x: 36, y: 55 },
        ],
        items: [
          {
            id: "p1",
            t: "paving",
            x: 40,
            y: 60,
            rot: 0,
            scale: 1,
            ghost: false,
          },
        ],
        strokes: [],
      },
      vicmapLot,
    );
    expect(next.boundary).toEqual(vicmapLot);
    // Building left edge should sit inside the new lot x-range
    const bx = next.building.map((p) => p.x);
    expect(Math.min(...bx)).toBeGreaterThan(38);
    expect(next.items[0]!.x).toBeGreaterThan(45);
  });
});

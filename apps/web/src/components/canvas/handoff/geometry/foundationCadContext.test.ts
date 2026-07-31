import { describe, expect, it } from "vitest";
import {
  formatCadAreaM2,
  formatCadBearing,
  formatCadMetres,
  polygonCentroid,
} from "./foundationCadContext";

const lot = [
  { x: 40, y: 20 },
  { x: 55, y: 20 },
  { x: 55, y: 80 },
  { x: 40, y: 80 },
];

describe("neighbourLotContext", () => {
  it("builds terrace neighbour rings left and right of a narrow lot", () => {
    const lots = neighbourLotContext(lot);
    expect(lots.length).toBeGreaterThanOrEqual(3);
    const left = lots.some((ring) => ring.every((p) => p.x < 40));
    const right = lots.some((ring) => ring.every((p) => p.x > 55));
    expect(left).toBe(true);
    expect(right).toBe(true);
  });

  it("drops collapsed verge bands when the lot sits near the board edge", () => {
    const topHeavy = [
      { x: 20, y: 2 },
      { x: 80, y: 2 },
      { x: 80, y: 40 },
      { x: 20, y: 40 },
    ];
    const lots = neighbourLotContext(topHeavy);
    for (const ring of lots) {
      const xs = ring.map((p) => p.x);
      const ys = ring.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(0.5);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe("polygonCentroid", () => {
  it("centres a rectangle", () => {
    const c = polygonCentroid(lot);
    expect(c.x).toBeCloseTo(47.5, 5);
    expect(c.y).toBeCloseTo(50, 5);
  });
});

describe("CAD formatters", () => {
  it("prints millimetre metres and area", () => {
    expect(formatCadMetres(5.12)).toBe("5.120 m");
    expect(formatCadAreaM2(186.2)).toBe("186 m²");
  });

  it("formats indicative bearings", () => {
    expect(formatCadBearing(0).length).toBeGreaterThan(0);
    expect(formatCadBearing(90).length).toBeGreaterThan(0);
  });
});

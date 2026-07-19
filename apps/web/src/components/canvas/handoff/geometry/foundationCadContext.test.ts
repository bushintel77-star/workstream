import { describe, expect, it } from "vitest";
import {
  formatCadAreaM2,
  formatCadMetres,
  neighbourLotContext,
  polygonCentroid,
} from "./foundationCadContext";

const lot = [
  { x: 40, y: 20 },
  { x: 55, y: 20 },
  { x: 55, y: 80 },
  { x: 40, y: 80 },
];

describe("neighbourLotContext", () => {
  it("builds terrace neighbour rings around a narrow lot", () => {
    const lots = neighbourLotContext(lot);
    expect(lots.length).toBeGreaterThanOrEqual(3);
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
});

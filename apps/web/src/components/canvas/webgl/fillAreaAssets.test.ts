import { describe, expect, it } from "vitest";
import { MAX_AREA_PLANTS, gridInBox } from "./fillAreaAssets";

describe("gridInBox", () => {
  it("fills a box at the requested spacing", () => {
    const pts = gridInBox(
      { x: 10, y: 10 },
      { x: 40, y: 40 },
      3,
      30,
      1,
    );
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.every((p) => p.x >= 10 && p.x <= 40)).toBe(true);
    expect(pts.every((p) => p.y >= 10 && p.y <= 40)).toBe(true);
  });

  it("caps runaway fills", () => {
    const pts = gridInBox({ x: 0, y: 0 }, { x: 100, y: 100 }, 0.2, 40, 1);
    expect(pts.length).toBe(MAX_AREA_PLANTS);
  });

  it("always yields at least the box centre when the box is a click", () => {
    const pts = gridInBox({ x: 50, y: 50 }, { x: 50.1, y: 50.1 }, 4, 30, 1);
    expect(pts.length).toBeGreaterThanOrEqual(1);
  });
});

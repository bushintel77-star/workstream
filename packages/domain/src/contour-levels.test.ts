import { describe, it, expect } from "vitest";
import {
  interpolateContourLevel,
  deriveCornerLevels,
  type ContourLine,
} from "./contour-levels";

// Helper: a horizontal contour line at a given elevation, with dense vertices.
function hLine(
  y: number,
  elev: number,
  x0 = 10,
  x1 = 90,
): ContourLine {
  const points: { x: number; y: number }[] = [];
  for (let x = x0; x <= x1; x += 5) {
    points.push({ x, y });
  }
  return { points, elevationM: elev };
}

describe("interpolateContourLevel", () => {
  it("returns null when there are no contours", () => {
    const result = interpolateContourLevel([], { x: 50, y: 50 });
    expect(result).toBeNull();
  });

  it("returns null when no contour vertices are within range", () => {
    const contours = [hLine(10, 100), hLine(90, 110)];
    const result = interpolateContourLevel(contours, { x: 50, y: 50 }, 5);
    expect(result).toBeNull();
  });

  it("returns the exact elevation when the query is on a contour", () => {
    const contours = [hLine(50, 105)];
    const result = interpolateContourLevel(contours, { x: 50, y: 50 });
    expect(result).not.toBeNull();
    expect(result!.z_m).toBe(105);
    expect(result!.source).toBe("vicmap_contour");
  });

  it("interpolates between two contours using IDW", () => {
    // Two horizontal contours: y=40 at 100 m, y=60 at 110 m.
    // Query at y=50 (midway) should give ~105 m.
    const contours = [hLine(40, 100), hLine(60, 110)];
    const result = interpolateContourLevel(contours, { x: 50, y: 50 });
    expect(result).not.toBeNull();
    expect(result!.z_m).toBeCloseTo(105, 0);
  });

  it("weights closer contours more heavily", () => {
    // Query at y=45 — closer to the 100 m contour than the 110 m contour.
    const contours = [hLine(40, 100), hLine(60, 110)];
    const result = interpolateContourLevel(contours, { x: 50, y: 45 });
    expect(result).not.toBeNull();
    // Should be closer to 100 than to 110.
    expect(result!.z_m).toBeLessThan(105);
    expect(result!.z_m).toBeGreaterThan(100);
  });

  it("reports accuracy as half the contour interval", () => {
    const contours = [hLine(40, 100), hLine(60, 101)]; // 1 m interval
    const result = interpolateContourLevel(contours, { x: 50, y: 50 });
    expect(result).not.toBeNull();
    expect(result!.accuracy_m).toBe(0.5);
  });

  it("defaults to 1 m accuracy when interval is unknown", () => {
    const contours = [hLine(50, 100)]; // single contour, no interval
    const result = interpolateContourLevel(contours, { x: 50, y: 50 });
    expect(result).not.toBeNull();
    expect(result!.accuracy_m).toBe(1);
  });
});

describe("deriveCornerLevels", () => {
  it("returns empty when there are no contours", () => {
    const boundary = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];
    const result = deriveCornerLevels([], boundary, []);
    expect(result).toHaveLength(0);
  });

  it("returns empty when boundary has fewer than 3 points", () => {
    const contours = [hLine(50, 100)];
    const result = deriveCornerLevels(contours, [{ x: 10, y: 10 }, { x: 90, y: 10 }], []);
    expect(result).toHaveLength(0);
  });

  it("derives levels at boundary corners", () => {
    const contours = [hLine(10, 100), hLine(90, 110)];
    const boundary = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];
    const result = deriveCornerLevels(contours, boundary, []);
    expect(result.length).toBeGreaterThan(0);
    for (const lv of result) {
      expect(lv.source).toBe("vicmap_contour");
      expect(lv.z_m).toBeGreaterThanOrEqual(100);
      expect(lv.z_m).toBeLessThanOrEqual(110);
    }
  });

  it("skips corners that already have an authored level nearby", () => {
    const contours = [hLine(10, 100), hLine(90, 110)];
    const boundary = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];
    // Authored level at the first corner.
    const existing = [{ x_pct: 10, y_pct: 10, z_m: 102 }];
    const result = deriveCornerLevels(contours, boundary, existing);
    // Should skip the first corner but derive the rest.
    const firstCorner = result.find(
      (lv) => Math.abs(lv.x_pct - 10) < 1 && Math.abs(lv.y_pct - 10) < 1,
    );
    expect(firstCorner).toBeUndefined();
  });
});

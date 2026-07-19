import { describe, expect, it } from "vitest";
import { inwardSetbackRing } from "./boundary-setback";

describe("inwardSetbackRing", () => {
  it("offsets vertices inward from centroid", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const inner = inwardSetbackRing(square, 1.5);
    expect(inner).toHaveLength(4);
    for (const p of inner) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(10);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(10);
    }
  });

  it("returns empty for fewer than three points", () => {
    expect(inwardSetbackRing([{ x: 0, y: 0 }], 1.5)).toEqual([]);
  });
});

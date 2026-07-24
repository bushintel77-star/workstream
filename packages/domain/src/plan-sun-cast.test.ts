import { describe, expect, it } from "vitest";
import {
  castRingShadowPct,
  growthHeightFactor,
  shadowLengthMetres,
  shadowOffsetPct,
} from "./plan-sun-cast";

describe("plan-sun-cast", () => {
  it("computes finite midday shadow lengths", () => {
    const midday = shadowLengthMetres(5, 55);
    expect(midday).toBeGreaterThan(1);
    expect(midday).toBeLessThan(20);
    expect(shadowLengthMetres(5, 1)).toBe(0);
  });

  it("casts southward when sun is north", () => {
    const { dx, dy } = shadowOffsetPct(10, 0, 100);
    expect(Math.abs(dx)).toBeLessThan(0.01);
    expect(dy).toBeCloseTo(10, 5);
  });

  it("builds a closed silhouette from a footprint", () => {
    const ring = [
      { x: 40, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 55 },
      { x: 40, y: 55 },
    ];
    const cast = castRingShadowPct(ring, 5, 40, 0, 50);
    expect(cast).not.toBeNull();
    expect(cast!.length).toBeGreaterThanOrEqual(8);
    expect(cast![0]).toEqual(cast![cast!.length - 1]);
  });

  it("scales growth height", () => {
    expect(growthHeightFactor("plant")).toBeLessThan(
      growthHeightFactor("mature"),
    );
  });
});

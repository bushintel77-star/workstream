import { describe, expect, it } from "vitest";
import { buildSpotLevelFall } from "./spotLevelFall";

describe("spot-level fall", () => {
  it("always points from the higher RL to the lower RL", () => {
    const low = { x: 10, y: 10, z: 12.1 };
    const high = { x: 20, y: 10, z: 12.35 };
    const result = buildSpotLevelFall(low, high, 100);
    expect(result?.high).toBe(high);
    expect(result?.low).toBe(low);
    expect(result?.distanceM).toBe(10);
    expect(result?.deltaMm).toBe(250);
    expect(result?.fallPct).toBe(2.5);
  });

  it("ignores coincident points and identifies level runs", () => {
    expect(
      buildSpotLevelFall(
        { x: 10, y: 10, z: 12 },
        { x: 10.1, y: 10, z: 11 },
        100,
      ),
    ).toBeNull();
    expect(
      buildSpotLevelFall(
        { x: 10, y: 10, z: 12 },
        { x: 20, y: 10, z: 12 },
        100,
      )?.flat,
    ).toBe(true);
  });
});

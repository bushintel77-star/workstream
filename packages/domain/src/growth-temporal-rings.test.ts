import { describe, expect, it } from "vitest";
import {
  buildGrowthTemporalRings,
  growthStageSpreadFactor,
} from "./growth-temporal-rings";

describe("growth-temporal-rings", () => {
  it("scales canopy with Year 1 / 5 / 10", () => {
    expect(growthStageSpreadFactor("plant")).toBe(0.45);
    expect(growthStageSpreadFactor("mature")).toBe(1);

    const base = {
      items: [
        { id: "a", type: "canopy", x: 40, y: 50, mature_spread_m: 8 },
      ],
      scaleM: 40,
    };
    const y1 = buildGrowthTemporalRings({ ...base, growth: "plant" });
    const y10 = buildGrowthTemporalRings({ ...base, growth: "mature" });
    expect(y1).toHaveLength(1);
    expect(y10).toHaveLength(1);
    expect(y10[0]!.canopy_rx_pct).toBeCloseTo(10, 5); // 4m / 40m * 100
    expect(y1[0]!.canopy_rx_pct).toBeCloseTo(4.5, 5); // 0.45 * 10
    expect(y10[0]!.root_rx_pct).toBeCloseTo(y10[0]!.canopy_rx_pct * 0.55, 5);
  });

  it("flags crowded neighbours at Year 10", () => {
    const rings = buildGrowthTemporalRings({
      growth: "mature",
      scaleM: 40,
      items: [
        { id: "a", type: "canopy", x: 40, y: 50, mature_spread_m: 8 },
        { id: "b", type: "canopy", x: 48, y: 50, mature_spread_m: 8 },
      ],
    });
    expect(rings.every((r) => r.crowded)).toBe(true);
  });

  it("skips existing trees and non-planting types", () => {
    const rings = buildGrowthTemporalRings({
      growth: "mature",
      scaleM: 40,
      items: [
        { id: "e", type: "exist", x: 20, y: 20, mature_spread_m: 10, existing: true },
        { id: "p", type: "paving", x: 30, y: 30 },
        { id: "c", type: "canopy", x: 40, y: 40 },
      ],
    });
    expect(rings).toHaveLength(1);
    expect(rings[0]!.id).toBe("c");
    expect(rings[0]!.mature_spread_m).toBe(6);
  });

  it("returns empty without ground scale", () => {
    expect(
      buildGrowthTemporalRings({
        growth: "mature",
        scaleM: 0,
        items: [{ id: "a", type: "canopy", x: 10, y: 10 }],
      }),
    ).toEqual([]);
  });
});

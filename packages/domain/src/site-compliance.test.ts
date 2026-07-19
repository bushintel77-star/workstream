import { describe, expect, it } from "vitest";
import { computeSiteCompliance } from "./site-compliance";

describe("computeSiteCompliance", () => {
  it("passes when permeable and no critical risks", () => {
    const stats = computeSiteCompliance({
      outdoorAreaM2: 200,
      spatialFacts: [
        {
          id: "lawn",
          label: "Lawn",
          layer: "softscape",
          area_m2: 120,
          x_pct: 50,
          y_pct: 50,
          source: "placement",
          length_m: 0,
          count: 1,
        },
        {
          id: "pave",
          label: "Paving",
          layer: "hardscape",
          area_m2: 40,
          x_pct: 30,
          y_pct: 30,
          source: "cad",
          length_m: 0,
          count: 1,
        },
      ],
      risks: [],
    });
    expect(stats.pass).toBe(true);
    expect(stats.permeablePct).toBeGreaterThanOrEqual(30);
  });

  it("flags low permeability", () => {
    const stats = computeSiteCompliance({
      outdoorAreaM2: 100,
      spatialFacts: [
        {
          id: "pave",
          label: "Paving",
          layer: "hardscape",
          area_m2: 90,
          x_pct: 50,
          y_pct: 50,
          source: "cad",
          length_m: 0,
          count: 1,
        },
      ],
      risks: [],
    });
    expect(stats.pass).toBe(false);
    expect(stats.permeablePct).toBeLessThan(30);
  });
});

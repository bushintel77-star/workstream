import { describe, expect, it } from "vitest";
import { buildSpatialTruthSnapshot, withSpatialTruthDefaults } from "./spatial-facts";

describe("spatial-facts", () => {
  it("locks site origin and hydrates service metrics", () => {
    const facts = withSpatialTruthDefaults([
      {
        id: "site",
        layer: "topography",
        label: "Site origin",
        source: "placement",
        area_m2: 0,
        length_m: 0,
        count: 1,
      },
      {
        id: "mainline",
        layer: "irrigation",
        label: "Mainline",
        source: "irrigation",
        area_m2: 0,
        length_m: 32,
        count: 1,
        depth_m: 0.45,
      },
    ]);

    expect(facts[0]?.origin_x).toBe(0);
    expect(facts[0]?.site_origin_locked).toBe(true);
    expect(facts[1]?.gpm).toBeGreaterThan(0);
    expect(facts[1]?.pressure_drop_kpa).toBeGreaterThan(0);

    const snapshot = buildSpatialTruthSnapshot(facts);
    expect(snapshot.siteOrigin).toEqual([0, 0, 0]);
    expect(snapshot.originLocked).toBe(true);
    expect(snapshot.totalGpm).toBeGreaterThan(0);
    expect(snapshot.serviceLineCount).toBe(1);
  });
});

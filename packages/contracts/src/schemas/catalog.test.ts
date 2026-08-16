/**
 * DesignSiteFrame boundary tests. north_bearing carries true-north orientation
 * so the aspect quadrant and sun/overshadowing vectors can be computed (never
 * stored). It is optional (legacy frames omit it) and constrained to 0–360.
 */
import { describe, expect, it } from "vitest";
import {
  CatalogPlacementSchema,
  DesignBydaAssetSchema,
  DesignSiteFrameSchema,
  IrrigationZoneSchema,
} from "../index";

describe("DesignSiteFrameSchema north_bearing", () => {
  it("parses a frame without north_bearing (legacy, uncalibrated)", () => {
    const parsed = DesignSiteFrameSchema.parse({});
    expect(parsed.north_bearing).toBeUndefined();
  });

  it("accepts a bearing at either end of the 0–360 range", () => {
    expect(DesignSiteFrameSchema.parse({ north_bearing: 0 }).north_bearing).toBe(0);
    expect(DesignSiteFrameSchema.parse({ north_bearing: 360 }).north_bearing).toBe(
      360,
    );
    expect(
      DesignSiteFrameSchema.parse({ north_bearing: 217.5 }).north_bearing,
    ).toBe(217.5);
  });

  it("rejects a bearing outside 0–360", () => {
    expect(DesignSiteFrameSchema.safeParse({ north_bearing: -1 }).success).toBe(
      false,
    );
    expect(
      DesignSiteFrameSchema.safeParse({ north_bearing: 360.1 }).success,
    ).toBe(false);
  });
});

describe("DesignSiteFrameSchema neighbour_buildings", () => {
  const ring = [
    { x_pct: 10, y_pct: 10 },
    { x_pct: 20, y_pct: 10 },
    { x_pct: 20, y_pct: 20 },
  ];

  it("defaults to an empty array on legacy frames", () => {
    expect(DesignSiteFrameSchema.parse({}).neighbour_buildings).toEqual([]);
  });

  describe("site-specific dimensions", () => {
    it("preserves measured tree dimensions on a placement", () => {
      const placement = CatalogPlacementSchema.parse({
        id: "39e6fd42-0336-43fe-8f65-bb588c210884",
        symbol_id: "tree-canopy",
        x_pct: 50,
        y_pct: 50,
        height_m: 9.2,
        canopy_radius_m: 3.4,
      });
      expect(placement.height_m).toBe(9.2);
      expect(placement.canopy_radius_m).toBe(3.4);
    });

    it("keeps utility depth and hydraulic inputs optional rather than inventing them", () => {
      const asset = DesignBydaAssetSchema.parse({
        id: "gas-1",
        kind: "gas",
        ring: [{ x_pct: 10, y_pct: 10 }, { x_pct: 20, y_pct: 20 }],
      });
      const zone = IrrigationZoneSchema.parse({
        id: "f320ee29-dbee-4cf5-8f87-a2aed6824ea2",
        name: "Drip line",
        points: [{ x_pct: 10, y_pct: 10 }, { x_pct: 20, y_pct: 20 }],
      });
      expect(asset.depth_m).toBeUndefined();
      expect(asset.tolerance_m).toBeUndefined();
      expect(zone.pipe_diameter_mm).toBeUndefined();
      expect(zone.hazen_williams_c).toBeUndefined();
    });
  });

  it("accepts a footprint and applies source/height_source defaults", () => {
    const parsed = DesignSiteFrameSchema.parse({
      neighbour_buildings: [{ id: "n1", ring, height_m: 6.4 }],
    });
    const n = parsed.neighbour_buildings[0]!;
    expect(n.source).toBe("vicmap");
    expect(n.height_source).toBe("assumed");
    expect(n.height_m).toBe(6.4);
  });

  it("rejects a footprint ring with fewer than 3 points", () => {
    expect(
      DesignSiteFrameSchema.safeParse({
        neighbour_buildings: [{ id: "n1", ring: ring.slice(0, 2) }],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive height", () => {
    expect(
      DesignSiteFrameSchema.safeParse({
        neighbour_buildings: [{ id: "n1", ring, height_m: 0 }],
      }).success,
    ).toBe(false);
  });
});

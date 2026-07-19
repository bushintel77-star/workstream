import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import {
  buildSiteSchedule,
  edgeSegments,
  pointInPolygon,
  polygonAreaM2,
  tpzRadiusPct,
} from "./polygon";

const SCALE = 110;

describe("polygon metrics", () => {
  it("computes a positive lot area for Wrights seed boundary", () => {
    const area = polygonAreaM2(WRIGHTS_SEED.boundary, SCALE);
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(800);
  });

  it("builds a site schedule with outdoor = lot − building", () => {
    const s = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      SCALE,
    );
    expect(s.outdoorAreaM2).toBeCloseTo(s.lotAreaM2 - s.buildingAreaM2, 5);
    expect(s.siteCoveragePct).toBeGreaterThan(0);
    expect(s.siteCoveragePct).toBeLessThan(100);
    expect(s.boundaryPerimeterM).toBeGreaterThan(20);
  });

  it("labels boundary edges B1…Bn", () => {
    const segs = edgeSegments(WRIGHTS_SEED.boundary, "B", SCALE);
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.key)).toEqual(["B1", "B2", "B3", "B4"]);
    for (const s of segs) {
      expect(s.lengthM).toBeGreaterThan(1);
    }
  });

  it("AS 4970 TPZ for 450 mm DBH is 5.4 m (12×0.45)", () => {
    const { radiusM, rxPct } = tpzRadiusPct(0.45, SCALE);
    expect(radiusM).toBeCloseTo(5.4, 5);
    expect(rxPct).toBeCloseTo((5.4 / SCALE) * 100, 5);
  });

  it("point-in-polygon detects interior of a square", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });
});

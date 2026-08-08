import { describe, expect, it } from "vitest";
import {
  countNearbyCanopy,
  rankCurtisFloraCandidates,
  sunHoursAtPct,
} from "./flora-suggestion";

describe("rankCurtisFloraCandidates", () => {
  it("returns up to 3 Curtis planting matches for full sun Prahran", () => {
    const top = rankCurtisFloraCandidates({
      address: "12 Wrights Terrace, Prahran VIC 3181",
      sunHours: 8,
      nearbyCanopyCount: 0,
      maxHeightM: 4,
      month: 7,
    });
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top[0]!.matureHeightM).toBeLessThanOrEqual(4);
    expect(top.every((c) => c.score > 0)).toBe(true);
  });

  it("prefers shade-tolerant stock when sun hours are low", () => {
    const shade = rankCurtisFloraCandidates({
      address: "14 Airlie Ave, Armadale VIC 3143",
      sunHours: 1.2,
      nearbyCanopyCount: 2,
      maxHeightM: 6,
      month: 7,
    });
    expect(shade.length).toBeGreaterThan(0);
    // Top match should not be full-sun only if shade candidates exist
    expect(shade[0]!.sun === "shade" || shade[0]!.sun === "partial").toBe(true);
  });

  it("respects height envelope", () => {
    const low = rankCurtisFloraCandidates({
      address: "Prahran VIC",
      sunHours: 7,
      maxHeightM: 0.8,
      month: 3,
    });
    expect(low.every((c) => c.matureHeightM <= 0.8)).toBe(true);
  });

  it("boosts preferred form for armed Add tool", () => {
    const hedge = rankCurtisFloraCandidates({
      address: "12 Wrights Terrace, Prahran VIC 3181",
      sunHours: 7,
      preferredForm: "hedge",
      maxHeightM: 4,
      month: 7,
    });
    expect(hedge[0]?.studioForm).toBe("hedge");
  });
});

describe("sunHoursAtPct / countNearbyCanopy", () => {
  it("samples shade grid cell", () => {
    const cells = [{ col: 0, row: 0, sunHours: 2.5 }];
    expect(sunHoursAtPct(5, 5, cells)).toBe(2.5);
  });

  it("counts nearby canopy", () => {
    expect(
      countNearbyCanopy(50, 50, [
        { t: "canopy", x: 52, y: 51 },
        { t: "paving", x: 50, y: 50 },
        { t: "exist", x: 80, y: 80 },
      ]),
    ).toBe(1);
  });
});

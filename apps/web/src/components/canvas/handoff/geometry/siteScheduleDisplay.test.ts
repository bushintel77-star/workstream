import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import { buildSiteSchedule } from "./polygon";
import {
  MAX_FOOTPRINT_COVERAGE_FRAC,
  resolveDisplayLotM2,
  resolveSiteAreaDisplay,
} from "./siteScheduleDisplay";

describe("resolveDisplayLotM2", () => {
  it("uses cadastral when coherent with the drawn building", () => {
    expect(
      resolveDisplayLotM2({
        cadastralLotM2: 620,
        buildingAreaM2: 180,
        drawnLotM2: 640,
      }),
    ).toEqual({ lotM2: 620, lotSource: "cadastral" });
  });

  it("falls back to the drawn lot when cadastral contradicts the plan (185 vs 3013 bug)", () => {
    // Vicmap parcel 185 m² but drawn dwelling 1329 m² — cadastral must lose,
    // so the on-plan Title callout matches the Site measures panel.
    expect(
      resolveDisplayLotM2({
        cadastralLotM2: 185,
        buildingAreaM2: 1329,
        drawnLotM2: 3013,
      }),
    ).toEqual({ lotM2: 3013, lotSource: "drawing" });
  });

  it("keeps cadastral when house area can replace an absurd dwelling ring", () => {
    expect(
      resolveDisplayLotM2({
        cadastralLotM2: 3810,
        buildingAreaM2: 9898,
        drawnLotM2: 3810,
        cadastralHouseM2: 220,
      }),
    ).toEqual({ lotM2: 3810, lotSource: "cadastral" });
  });

  it("falls back to the drawn lot when cadastral is missing or degenerate", () => {
    expect(
      resolveDisplayLotM2({
        cadastralLotM2: null,
        buildingAreaM2: 100,
        drawnLotM2: 500,
      }).lotSource,
    ).toBe("drawing");
    expect(
      resolveDisplayLotM2({
        cadastralLotM2: 3, // below the 5 m² sanity floor
        buildingAreaM2: 0,
        drawnLotM2: 500,
      }).lotSource,
    ).toBe("drawing");
  });
});

describe("resolveSiteAreaDisplay", () => {
  it("outdoor is lot minus building when cadastral lot applies", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    expect(schedule.buildingAreaM2).toBeGreaterThan(10);
    // Lot must leave ≥20% remnant so the dwelling stays under the 80% cap.
    const lot = Math.ceil(schedule.buildingAreaM2 / MAX_FOOTPRINT_COVERAGE_FRAC + 40);
    const display = resolveSiteAreaDisplay({
      schedule,
      cadastralLotM2: lot,
    });
    expect(display.lotAreaM2).toBe(lot);
    expect(display.buildingAreaM2).toBe(schedule.buildingAreaM2);
    expect(display.outdoorAreaM2).toBeCloseTo(lot - schedule.buildingAreaM2, 5);
    expect(display.outdoorDiffersFromNaive).toBe(false);
    expect(display.lotSource).toBe("cadastral");
    expect(display.siteCoveragePct).toBeLessThanOrEqual(100);
  });

  it("rejects cadastral lot smaller than drawn building (scale mismatch)", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const display = resolveSiteAreaDisplay({
      schedule,
      cadastralLotM2: 1, // classic template disconnect
    });
    expect(display.buildingAreaM2).toBe(schedule.buildingAreaM2);
    expect(display.lotSource).toBe("drawing");
    expect(display.outdoorAreaM2).toBeCloseTo(
      schedule.lotAreaM2 - schedule.buildingAreaM2,
      5,
    );
  });

  it("falls back to drawn lot when cadastral missing — keeps boolean outdoor", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const display = resolveSiteAreaDisplay({ schedule, cadastralLotM2: null });
    expect(display.lotSource).toBe("drawing");
    expect(display.lotAreaM2).toBe(schedule.lotAreaM2);
    expect(display.outdoorAreaM2).toBeCloseTo(schedule.outdoorAreaM2, 5);
    expect(display.outdoorDiffersFromNaive).toBe(
      schedule.outdoorDiffersFromNaive,
    );
  });

  it("never prints dwelling >80% of lot or coverage >100% (9898 on 3810 bug)", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const inflated = {
      ...schedule,
      buildingAreaM2: 9898.45,
      lotAreaM2: 3810.31,
      outdoorAreaM2: 0,
      outdoorNaiveM2: 0,
      siteCoveragePct: 260,
    };
    const display = resolveSiteAreaDisplay({
      schedule: inflated,
      cadastralLotM2: 3810.31,
      cadastralHouseM2: 245,
    });
    expect(display.lotAreaM2).toBeCloseTo(3810.31, 2);
    expect(display.buildingAreaM2).toBeCloseTo(245, 2);
    expect(display.buildingSource).toBe("cadastral");
    expect(display.buildingSanitized).toBe(true);
    expect(display.buildingAreaM2).toBeLessThanOrEqual(
      display.lotAreaM2 * MAX_FOOTPRINT_COVERAGE_FRAC + 0.5,
    );
    expect(display.siteCoveragePct).toBeLessThanOrEqual(100);
    expect(display.siteCoveragePct).toBe(
      Math.round((245 / 3810.31) * 100),
    );
  });

  it("clamps absurd dwelling when no cadastral house is available", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const inflated = {
      ...schedule,
      buildingAreaM2: 9898.45,
      lotAreaM2: 3810.31,
      outdoorAreaM2: 0,
      outdoorNaiveM2: 0,
      siteCoveragePct: 260,
    };
    const display = resolveSiteAreaDisplay({
      schedule: inflated,
      cadastralLotM2: 3810.31,
    });
    // No house fallback → drawn lot kept (building contradicts cadastral alone)
    // then clamp dwelling to 80% of that lot.
    expect(display.buildingSanitized).toBe(true);
    expect(display.buildingAreaM2).toBeLessThanOrEqual(
      display.lotAreaM2 * MAX_FOOTPRINT_COVERAGE_FRAC + 0.01,
    );
    expect(display.siteCoveragePct).toBeLessThanOrEqual(100);
  });
});

import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import { buildSiteSchedule } from "./polygon";
import {
  resolveDisplayLotM2,
  resolveFitSheetAreas,
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

describe("resolveFitSheetAreas", () => {
  it("outdoor is lot minus building when cadastral lot applies", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    expect(schedule.buildingAreaM2).toBeGreaterThan(10);
    const lot = Math.ceil(schedule.buildingAreaM2 + 40);
    const display = resolveFitSheetAreas({
      schedule,
      cadastralLotM2: lot,
    });
    expect(display.lotAreaM2).toBe(lot);
    expect(display.buildingAreaM2).toBe(schedule.buildingAreaM2);
    expect(display.outdoorAreaM2).toBeCloseTo(lot - schedule.buildingAreaM2, 5);
    expect(display.outdoorDiffersFromNaive).toBe(false);
    expect(display.lotSource).toBe("cadastral");
  });

  it("rejects cadastral lot smaller than drawn building (scale mismatch)", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const display = resolveFitSheetAreas({
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
    const display = resolveFitSheetAreas({ schedule, cadastralLotM2: null });
    expect(display.lotSource).toBe("drawing");
    expect(display.lotAreaM2).toBe(schedule.lotAreaM2);
    expect(display.outdoorAreaM2).toBeCloseTo(schedule.outdoorAreaM2, 5);
    expect(display.outdoorDiffersFromNaive).toBe(
      schedule.outdoorDiffersFromNaive,
    );
  });
});

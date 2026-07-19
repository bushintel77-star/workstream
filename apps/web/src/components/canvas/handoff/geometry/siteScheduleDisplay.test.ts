import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import { buildSiteSchedule } from "./polygon";
import { resolveFitSheetAreas } from "./siteScheduleDisplay";

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

  it("falls back to drawn lot when cadastral missing", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      110,
    );
    const display = resolveFitSheetAreas({ schedule, cadastralLotM2: null });
    expect(display.lotSource).toBe("drawing");
    expect(display.lotAreaM2).toBe(schedule.lotAreaM2);
    expect(display.outdoorAreaM2).toBeCloseTo(
      schedule.lotAreaM2 - schedule.buildingAreaM2,
      5,
    );
  });
});

import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import { buildSiteSchedule } from "./polygon";
import { resolveFitSheetAreas } from "./siteScheduleDisplay";

describe("resolveFitSheetAreas", () => {
  it("never uses a bogus cadastral house area — footprint from drawing", () => {
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
    // Outdoor stays boolean-from-drawing (not cadastral − building).
    expect(display.outdoorAreaM2).toBe(schedule.outdoorAreaM2);
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
    expect(display.outdoorAreaM2).toBe(schedule.outdoorAreaM2);
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
  });

  it("surfaces outdoorDiffersFromNaive from the schedule", () => {
    const lot = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ];
    const overhang = [
      { x: 65, y: 40 },
      { x: 95, y: 40 },
      { x: 95, y: 60 },
      { x: 65, y: 60 },
    ];
    const schedule = buildSiteSchedule(lot, overhang, 110);
    const display = resolveFitSheetAreas({ schedule });
    expect(display.outdoorDiffersFromNaive).toBe(true);
    expect(display.outdoorNaiveM2).toBe(schedule.outdoorNaiveM2);
  });
});

import { describe, expect, it } from "vitest";
import {
  daylightHoursAt,
  dayOfYearFrom,
  solarDeclinationRad,
} from "./solar-window";

describe("solar-window", () => {
  it("declination is positive near the June solstice, negative near December", () => {
    expect(solarDeclinationRad(172)).toBeGreaterThan(0.35); // ~+23°
    expect(solarDeclinationRad(355)).toBeLessThan(-0.35); // ~-23°
  });

  it("Melbourne gets long summer days and short winter days", () => {
    const summer = daylightHoursAt(-37.84, 355); // mid-December
    const winter = daylightHoursAt(-37.84, 172); // mid-June
    expect(summer).toBeGreaterThan(14); // ~14.8h
    expect(winter).toBeLessThan(10); // ~9.5h
  });

  it("equator is ~12h year-round", () => {
    expect(daylightHoursAt(0, 172)).toBeCloseTo(12, 0);
    expect(daylightHoursAt(0, 355)).toBeCloseTo(12, 0);
  });

  it("never returns NaN or negatives for inhabited latitudes", () => {
    for (const lat of [-38, -30, 0, 30, 38, 60]) {
      for (const doy of [1, 90, 172, 265, 355]) {
        const h = daylightHoursAt(lat, doy);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(24);
      }
    }
  });

  it("computes day of year from a date", () => {
    expect(dayOfYearFrom(new Date("2026-01-01T00:00:00Z"))).toBe(1);
    expect(dayOfYearFrom(new Date("2026-02-01T00:00:00Z"))).toBe(32);
    expect(dayOfYearFrom(new Date("2026-12-31T00:00:00Z"))).toBe(365);
  });
});

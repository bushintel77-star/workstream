import { describe, expect, it } from "vitest";
import {
  approximateDaylight,
  melbourneSeason,
  sunPositionAt,
} from "./site-environment";

describe("site-environment", () => {
  it("returns southern hemisphere season label", () => {
    const may = melbourneSeason(new Date("2026-05-15T12:00:00+10:00"));
    expect(may.label.toLowerCase()).toContain("autumn");
    expect(may.month).toBe("May");
  });

  it("computes sun altitude at midday", () => {
    const noon = new Date("2026-06-21T12:00:00+10:00");
    const pos = sunPositionAt(-37.81, 144.96, noon);
    expect(pos.altitude_deg).toBeGreaterThan(20);
    expect(pos.azimuth_label.length).toBeGreaterThan(0);
  });

  it("approximates daylight hours", () => {
    const d = approximateDaylight(-37.81, new Date("2026-06-21T12:00:00+10:00"));
    expect(d.daylight_hours).toBeGreaterThan(9);
    expect(d.sunrise_local).toMatch(/^\d{2}:\d{2}$/);
  });
});

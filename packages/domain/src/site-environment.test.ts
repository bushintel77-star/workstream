import { describe, expect, it } from "vitest";
import {
  approximateDaylight,
  boardAzimuthDeg,
  boardShadowCast,
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

  it("casts board shadow south at Melbourne noon (az≈0)", () => {
    const cast = boardShadowCast(0, 35, { growthScale: 1 });
    expect(cast.dxPct).toBeCloseTo(0, 1);
    expect(cast.dyPct).toBeGreaterThan(0);
    expect(cast.dyFactor).toBeGreaterThan(0);
    expect(cast.lengthM).toBeGreaterThan(1);
  });

  it("lengthens shadow when sun is low and suppresses below horizon", () => {
    const low = boardShadowCast(90, 8, { growthScale: 1 });
    const high = boardShadowCast(90, 55, { growthScale: 1 });
    expect(low.lengthM).toBeGreaterThan(high.lengthM);
    expect(boardShadowCast(0, 0).lengthM).toBe(0);
  });

  it("boardAzimuthDeg is a no-op on a north-up board", () => {
    expect(boardAzimuthDeg(0)).toBe(0);
    expect(boardAzimuthDeg(215.4)).toBe(215.4);
  });

  it("boardAzimuthDeg subtracts north_bearing and wraps into 0–360", () => {
    // Board rotated so up faces east (bearing 90): a true-north sun (0°) sits
    // at board azimuth 270.
    expect(boardAzimuthDeg(0, 90)).toBe(270);
    // True azimuth behind board-up wraps rather than going negative.
    expect(boardAzimuthDeg(30, 45)).toBe(345);
  });
});

/**
 * The WebGL sun rig has no manual altitude multiplier — seasonal shadow length
 * comes from the real declination of the sampled date. These tests pin that
 * behaviour so a fudge factor (or a stale "55% winter lowering" claim) cannot
 * sneak back in and double-apply on top of the physics.
 */

import { describe, expect, it } from "vitest";
import { resolveSunLightPosition } from "./sunLight";

const MEL_LAT = -37.81;
const MEL_LNG = 144.96;
const NOON = 12 * 60;
/** 12:00 AEST — deterministic year for the solstice presets. */
const AUG_NOON = new Date("2026-08-17T02:00:00Z");

function shadowLengthM(altitudeDeg: number): number {
  const rad = (Math.max(altitudeDeg, 3) * Math.PI) / 180;
  return 1 / Math.tan(rad);
}

describe("resolveSunLightPosition", () => {
  it("lowers the winter sun below the summer sun from real declination", () => {
    const winter = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "winter",
      NOON,
      100,
      3,
      AUG_NOON,
    );
    const summer = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "summer",
      NOON,
      100,
      3,
      AUG_NOON,
    );

    expect(winter.altitudeDeg).toBeGreaterThan(20);
    expect(winter.altitudeDeg).toBeLessThan(40);
    // Wall-clock noon sits before solar noon in AEDT, so the summer peak
    // (~75°) hasn't been reached yet — but it's still far above winter.
    expect(summer.altitudeDeg).toBeGreaterThan(60);
    expect(winter.altitudeDeg).toBeLessThan(summer.altitudeDeg);
  });

  it("casts longer shadows in winter than in summer", () => {
    const winter = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "winter",
      NOON,
      100,
      3,
      AUG_NOON,
    );
    const summer = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "summer",
      NOON,
      100,
      3,
      AUG_NOON,
    );

    expect(shadowLengthM(winter.altitudeDeg)).toBeGreaterThan(
      shadowLengthM(summer.altitudeDeg),
    );
  });

  it("places the winter-noon light due north so shadows fall south", () => {
    const noon = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "winter",
      NOON,
      100,
      3,
      AUG_NOON,
    );

    expect(Math.min(noon.azimuthDeg, 360 - noon.azimuthDeg)).toBeLessThan(15);
    // −Z = north light → objects cast shadows toward +Z (south).
    expect(noon.position[2]).toBeLessThan(0);
  });

  it("floors a below-horizon sun to a finite above-ground light", () => {
    const dawn = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "winter",
      6 * 60 + 20,
      100,
      3,
      AUG_NOON,
    );

    // True altitude is below the horizon in a Melbourne winter dawn…
    expect(dawn.altitudeDeg).toBeLessThan(0);
    // …but the emitted light is floored to the minimum altitude, never negative.
    expect(dawn.position[1]).toBeGreaterThan(0);
  });

  it("honours a custom altitude floor (GrowthStudio's 6° clamp)", () => {
    const dawn = resolveSunLightPosition(
      MEL_LAT,
      MEL_LNG,
      "winter",
      6 * 60 + 20,
      100,
      6,
      AUG_NOON,
    );

    // Below-horizon sun clamped to the 6° floor: height = sin(6°) × sunDist.
    expect(dawn.position[1]).toBeCloseTo(
      Math.sin((6 * Math.PI) / 180) * 100,
      1,
    );
  });
});

/**
 * Gold Standard 2026 — real-sun directional-light projection.
 *
 * Pure function: world solar position (`sunPositionAt`) → a Three.js
 * directional-light position, shared by the WebGL studio (and previously
 * inlined in GrowthStudioClient).
 *
 * Convention: +X = east, +Y = up, +Z = south (azimuth 0°/north → −Z), so
 * Melbourne noon puts the light due north and casts shadows south.
 *
 * SEASONAL SUN — there is no manual altitude multiplier. The altitude already
 * varies with the sampled date's declination: at Melbourne solar noon the sun
 * is ≈ 29° at the June solstice and ≈ 75° at the December solstice, so winter
 * shadows are genuinely longer because the sun is genuinely lower. This is the
 * single source of seasonal sun truth — do not add an altitude fudge on top of
 * the real declination.
 */

import { sunPositionAt } from "@workstream/domain";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../handoff/features/sunGrowth/sunDatePreset";

export interface SunLightPosition {
  /** Three.js light position (metres from the world origin). */
  position: [number, number, number];
  /** True (un-floored) solar altitude, for intensity/readout consumers. */
  altitudeDeg: number;
  /** Solar azimuth — 0° = north, 90° = east. */
  azimuthDeg: number;
}

export function resolveSunLightPosition(
  lat: number,
  lng: number,
  sunDatePreset: SunDatePreset,
  sunMin: number,
  sunDist: number,
  minAltitudeDeg = 3,
  now: Date = new Date(),
): SunLightPosition {
  const when = sunDateFromPreset(sunDatePreset, sunMin, now);
  const sun = sunPositionAt(lat, lng, when);
  // Floor altitude so a grazing sun produces long-but-finite shadows instead
  // of stretching toward infinity (shadow length ∝ 1/tan(altitude)).
  const altRad =
    (Math.max(sun.altitude_deg, minAltitudeDeg) * Math.PI) / 180;
  const azRad = (sun.azimuth_deg * Math.PI) / 180;
  return {
    position: [
      Math.cos(altRad) * Math.sin(azRad) * sunDist,
      Math.sin(altRad) * sunDist,
      -Math.cos(altRad) * Math.cos(azRad) * sunDist,
    ],
    altitudeDeg: sun.altitude_deg,
    azimuthDeg: sun.azimuth_deg,
  };
}

import { boardShadowCast, sunPositionAt, type BoardShadowCast } from "@workstream/domain";
import type { GrowthStage } from "../../state/studioTypes";
import { sunDateFromPreset, type SunDatePreset } from "./sunDatePreset";

/** Prahran demo fallback when project geocode is missing. */
export const DEFAULT_SUN_LAT = -37.849;
export const DEFAULT_SUN_LNG = 144.993;

const GROWTH_SCALE: Record<GrowthStage, number> = {
  plant: 0.55,
  "5yr": 0.85,
  mature: 1,
};

export type ResolveBoardSunCastInput = {
  shadeOn: boolean;
  sunMin: number;
  datePreset: SunDatePreset;
  growth: GrowthStage;
  lat?: number | null;
  lng?: number | null;
  boardWidthM?: number;
};

/**
 * Live board shadow when shade is armed; null means keep static SUN_SHADOW.
 */
export function resolveBoardSunCast(
  input: ResolveBoardSunCastInput,
): BoardShadowCast | null {
  if (!input.shadeOn) return null;
  const lat = input.lat ?? DEFAULT_SUN_LAT;
  const lng = input.lng ?? DEFAULT_SUN_LNG;
  const when = sunDateFromPreset(input.datePreset, input.sunMin);
  const pos = sunPositionAt(lat, lng, when);
  return boardShadowCast(pos.azimuth_deg, pos.altitude_deg, {
    growthScale: GROWTH_SCALE[input.growth] ?? 1,
    boardWidthM: input.boardWidthM,
  });
}

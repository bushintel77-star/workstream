/**
 * Live environment readout for the sticky Env card — indicative Workflow 1.
 */

import {
  buildIndicativeShadeGrid,
  frostRiskFromMinTemp,
  frostRiskLabel,
  heatRiskFromMaxTemp,
  heatRiskLabel,
  melbourneSeason,
  sunPositionAt,
  weatherConditionFromDay,
  type FrostRiskLevel,
  type HeatRiskLevel,
  type WeatherCondition,
} from "@workstream/domain";
import type { GrowthStage } from "../../state/studioTypes";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";

export type EnvWeatherDay = {
  precipitation_mm?: number;
  wind_speed_kmh?: number;
  wind_max_kph?: number;
  temp_max_c?: number;
  temp_min_c?: number;
  humidity_pct?: number | null;
};

export type EnvLiveMeta = {
  seasonLabel: string;
  clock: string;
  growthLabel: string;
  datePreset: SunDatePreset;
  avgSunHours: number;
  deepShadeCells: number;
  cellCount: number;
  altitudeDeg: number;
  azimuthLabel: string;
  /** Weather glyph for the boundary rail. */
  weatherCondition: WeatherCondition;
  /** Optional live temp face cue. */
  tempMaxC: number | null;
  tempMinC: number | null;
  humidityPct: number | null;
  frostRisk: FrostRiskLevel | null;
  heatRisk: HeatRiskLevel | null;
  humidityLabel: string;
  frostLabel: string;
  heatLabel: string;
  /** One-line face copy (no emoji — icon sits beside). */
  face: string;
  detail: string;
};

function formatSun(min: number) {
  const hh = Math.floor(min / 60);
  const mm = Math.round(min % 60);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "pm" : "am";
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

const GROWTH: Record<GrowthStage, string> = {
  plant: "plant",
  "5yr": "5 yr",
  mature: "mature",
};

/** Prahran demo centroid when live lat/lng absent — matches flora shade sample. */
const FALLBACK_LAT = -37.849;
const FALLBACK_LNG = 144.993;

/** Prefer Open-Meteo day; else indicative from solar altitude at scrubber. */
export function resolveEnvWeatherCondition(
  day: EnvWeatherDay | null | undefined,
  altitudeDeg: number,
): WeatherCondition {
  if (day) {
    const wind = day.wind_max_kph ?? day.wind_speed_kmh ?? 0;
    return weatherConditionFromDay(day.precipitation_mm ?? 0, wind, 0);
  }
  if (altitudeDeg < 8) return "cloud";
  return "sun";
}

export function buildEnvLiveMeta(args: {
  sunMin: number;
  sunDatePreset: SunDatePreset;
  growth: GrowthStage;
  lat?: number | null;
  lng?: number | null;
  shadeOn: boolean;
  weatherDay?: EnvWeatherDay | null;
}): EnvLiveMeta {
  const lat = args.lat ?? FALLBACK_LAT;
  const lng = args.lng ?? FALLBACK_LNG;
  const when = sunDateFromPreset(args.sunDatePreset, args.sunMin);
  const season = melbourneSeason(when);
  const cells = buildIndicativeShadeGrid(lat, lng, when);
  const avg =
    cells.reduce((s, c) => s + c.sunHours, 0) / Math.max(1, cells.length);
  const deep = cells.filter((c) => c.sunHours < 3.5).length;
  const sun = sunPositionAt(lat, lng, when);
  const clock = formatSun(args.sunMin);
  const growthLabel = GROWTH[args.growth];
  const weatherCondition = resolveEnvWeatherCondition(
    args.weatherDay,
    sun.altitude_deg,
  );
  const tempMaxC =
    args.weatherDay?.temp_max_c != null &&
    Number.isFinite(args.weatherDay.temp_max_c)
      ? args.weatherDay.temp_max_c
      : null;
  const tempMinC =
    args.weatherDay?.temp_min_c != null &&
    Number.isFinite(args.weatherDay.temp_min_c)
      ? args.weatherDay.temp_min_c
      : null;
  const humidityPct =
    args.weatherDay?.humidity_pct != null &&
    Number.isFinite(args.weatherDay.humidity_pct)
      ? Math.round(args.weatherDay.humidity_pct)
      : null;
  const frostRisk =
    tempMinC != null ? frostRiskFromMinTemp(tempMinC) : null;
  const heatRisk = tempMaxC != null ? heatRiskFromMaxTemp(tempMaxC) : null;
  const humidityLabel =
    humidityPct != null ? `${humidityPct}%` : "—";
  const frostLabel =
    frostRisk != null
      ? frostRiskLabel(frostRisk) +
        (tempMinC != null ? ` · ${Math.round(tempMinC)}° min` : "")
      : "—";
  const heatLabel =
    heatRisk != null
      ? heatRiskLabel(heatRisk) +
        (tempMaxC != null ? ` · ${Math.round(tempMaxC)}° max` : "")
      : "—";
  const tempBit = tempMaxC != null ? ` · ${Math.round(tempMaxC)}°` : "";
  const face = `${avg.toFixed(1)}h · ${season.label} · ${clock}${tempBit}`;
  const detail = args.shadeOn
    ? `${deep}/${cells.length} deep shade · ${growthLabel} · mesh on`
    : `${deep}/${cells.length} deep shade · ${growthLabel} · mesh off`;
  return {
    seasonLabel: season.label,
    clock,
    growthLabel,
    datePreset: args.sunDatePreset,
    avgSunHours: avg,
    deepShadeCells: deep,
    cellCount: cells.length,
    altitudeDeg: sun.altitude_deg,
    azimuthLabel: sun.azimuth_label,
    weatherCondition,
    tempMaxC,
    tempMinC,
    humidityPct,
    frostRisk,
    heatRisk,
    humidityLabel,
    frostLabel,
    heatLabel,
    face,
    detail,
  };
}

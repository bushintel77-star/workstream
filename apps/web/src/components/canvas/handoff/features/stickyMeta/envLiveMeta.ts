/**
 * Live environment readout for the sticky Env card — indicative Workflow 1.
 */

import {
  buildIndicativeShadeGrid,
  melbourneSeason,
  sunPositionAt,
} from "@workstream/domain";
import type { GrowthStage } from "../../state/studioTypes";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../sunGrowth/sunDatePreset";

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
  /** One-line face copy. */
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

export function buildEnvLiveMeta(args: {
  sunMin: number;
  sunDatePreset: SunDatePreset;
  growth: GrowthStage;
  lat?: number | null;
  lng?: number | null;
  shadeOn: boolean;
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
  const face = `Env · ${avg.toFixed(1)}h · ${season.label} · ${clock}`;
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
    face,
    detail,
  };
}

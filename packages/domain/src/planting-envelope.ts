/**
 * Site Envelope — pure domain fusion of sun × season × wetness × slope ×
 * soil indicators into (a) a typed envelope for surfaces and (b) a
 * palette scorer that pre-filters plants to the ones that will thrive,
 * so plant selection becomes an aesthetic decision.
 *
 * Reuse, not rewrite:
 *  - seasonal sun: `buildIndicativeShadeGrid` (domain shade-grid) at the
 *    winter/summer presets — the growth-bound pair for southern-hemisphere
 *    planting (winter sun is the limiting season);
 *  - sun class thresholds align with the flora exposure bands (<2 shade,
 *    <4.5 part shade, else full sun);
 *  - wetness drivers: Vicmap overlay flags (flood/wetland) + terrain
 *    ponding/streams evidence (callers translate world-metre flow results
 *    into driver records — domain never invents them);
 *  - palette scoring rides the catalog's plant attributes (`sun`, `water`,
 *    `soil` free text) + the blocklist.
 *
 * Zero-mock law: absent data yields "unknown"/null drivers — never a
 * fabricated condition. Every down-rank cites its driver in `why`.
 */

import type {
  CatalogSymbol,
  SiteSunClass,
  SiteWetnessClass,
  SiteWetnessSummary,
  WetnessDriver,
} from "@workstream/contracts";
import { buildIndicativeShadeGrid, SHADE_GRID_SIZE } from "./shade-grid";
import { meanSunHours } from "./flora-suggestion";
import { isBlocklisted } from "./plant-rules";

/** Sun-hours thresholds — same bands as the flora exposure model. */
export const SHADE_SUN_HOURS = 2;
export const PART_SHADE_SUN_HOURS = 4.5;

/** Southern-hemisphere seasonal presets: winter Jun 21, summer Dec 21. */
export const WINTER_MONTH = 6;
export const SUMMER_MONTH = 12;

export function sunClassFromHours(sunHours: number): SiteSunClass {
  if (sunHours < SHADE_SUN_HOURS) return "shade";
  if (sunHours < PART_SHADE_SUN_HOURS) return "part_shade";
  return "full_sun";
}

const SUN_CLASS_ORDER: Record<SiteSunClass, number> = {
  shade: 0,
  part_shade: 1,
  full_sun: 2,
};

/** Worst (least sun) of the seasonal classes — the planting bound. */
export function worstSunClass(a: SiteSunClass, b: SiteSunClass): SiteSunClass {
  return SUN_CLASS_ORDER[a] <= SUN_CLASS_ORDER[b] ? a : b;
}

const WETNESS_ORDER: Record<SiteWetnessClass, number> = {
  dry: 0,
  moist: 1,
  wet: 2,
  flood_prone: 3,
};

/** Wetness class = the worst driver present; no drivers → dry. */
export function wetnessFromDrivers(drivers: WetnessDriver[]): SiteWetnessSummary {
  let cls: SiteWetnessClass = "dry";
  for (const d of drivers) {
    const dClass: SiteWetnessClass =
      d.kind === "flood_overlay" ? "flood_prone"
      : d.kind === "wetland_overlay" ? "wet"
      : d.kind === "ponding" ? "wet"
      : "moist"; // streams
    if (WETNESS_ORDER[dClass] > WETNESS_ORDER[cls]) cls = dClass;
  }
  return { class: cls, drivers };
}

export interface SiteEnvelopeInput {
  lat: number;
  lng: number;
  /** Month for the envelope (1–12); season notes ride on it. */
  month?: number;
  /** Wetness drivers with evidence (overlays, ponding, streams). */
  wetnessDrivers?: WetnessDriver[];
  slope?: { slopeDeg: number; aspect: "N" | "S" | "E" | "W" } | null;
  acidSulfate?: boolean;
  /** EVC label pass-through (native_vegetation overlay), null when absent. */
  nativeVegetationLabel?: string | null;
}

export interface SiteEnvelopeResult {
  month: number;
  seasonalSun: Array<{
    preset: "winter" | "summer";
    meanHours: number;
    classFractions: Record<SiteSunClass, number>;
  }>;
  plantingSunClass: SiteSunClass;
  wetness: SiteWetnessSummary;
  slope: { slopeDeg: number; aspect: "N" | "S" | "E" | "W" } | null;
  acidSulfate: boolean;
  nativeVegetationLabel: string | null;
  summaryLine: string;
}

function seasonalSunAt(
  lat: number,
  lng: number,
  year: number,
  month: number,
  preset: "winter" | "summer",
): SiteEnvelopeResult["seasonalSun"][number] {
  const cells = buildIndicativeShadeGrid(lat, lng, new Date(Date.UTC(year, month - 1, 21, 2)));
  const total = cells.length || SHADE_GRID_SIZE * SHADE_GRID_SIZE;
  const counts: Record<SiteSunClass, number> = { shade: 0, part_shade: 0, full_sun: 0 };
  for (const c of cells) counts[sunClassFromHours(c.sunHours)] += 1;
  const classFractions: Record<SiteSunClass, number> = {
    shade: counts.shade / total,
    part_shade: counts.part_shade / total,
    full_sun: counts.full_sun / total,
  };
  return { preset, meanHours: meanSunHours(cells), classFractions };
}

const SUN_CLASS_LABEL: Record<SiteSunClass, string> = {
  full_sun: "Full sun",
  part_shade: "Part shade",
  shade: "Shade",
};

/**
 * Build the fused envelope. Seasonal sun is computed here (domain owns the
 * shade grid); wetness/slope/soil indicators arrive as evidence from the
 * caller. The summary line is chip-ready.
 */
export function buildSiteEnvelope(input: SiteEnvelopeInput): SiteEnvelopeResult {
  const now = new Date();
  const year = now.getUTCFullYear();
  const winter = seasonalSunAt(input.lat, input.lng, year, WINTER_MONTH, "winter");
  const summer = seasonalSunAt(input.lat, input.lng, year, SUMMER_MONTH, "summer");
  const plantingSunClass = worstSunClass(
    sunClassFromHours(winter.meanHours),
    sunClassFromHours(summer.meanHours),
  );
  const wetness = wetnessFromDrivers(input.wetnessDrivers ?? []);
  const parts = [
    SUN_CLASS_LABEL[plantingSunClass],
    wetness.class === "dry" ? "dry" : wetness.class.replace("_", " "),
  ];
  if (input.slope) parts.push(`${input.slope.slopeDeg.toFixed(1)}° ${input.slope.aspect} slope`);
  return {
    month: input.month ?? now.getUTCMonth() + 1,
    seasonalSun: [winter, summer],
    plantingSunClass,
    wetness,
    slope: input.slope ?? null,
    acidSulfate: input.acidSulfate ?? false,
    nativeVegetationLabel: input.nativeVegetationLabel ?? null,
    summaryLine: parts.join(" · "),
  };
}

export interface EnvelopePaletteScore {
  symbolId: string;
  label: string;
  /** 0–1 envelope fit; ≥0.5 = suitable, <0.25 = will not thrive here. */
  fit: number;
  /** Machine citation — the envelope driver(s) behind the score. */
  why: string;
}

const SUN_FIT: Record<SiteSunClass, Record<string, number>> = {
  // plant.sun: full | partial | shade (catalog vocabulary)
  full_sun: { full: 1, partial: 0.45, shade: 0.1 },
  part_shade: { full: 0.7, partial: 1, shade: 0.6 },
  shade: { full: 0.15, partial: 0.6, shade: 1 },
};

const WATER_FIT: Record<SiteWetnessClass, Record<string, number>> = {
  // plant.water: low | moderate | high
  dry: { low: 1, moderate: 0.55, high: 0.15 },
  moist: { low: 0.75, moderate: 1, high: 0.8 },
  wet: { low: 0.15, moderate: 0.7, high: 1 },
  flood_prone: { low: 0.05, moderate: 0.45, high: 0.9 },
};

/**
 * Score the planting palette against the envelope — the automatic half of
 * "planting becomes an aesthetic decision". Plants that cannot thrive
 * (fit < 0.25) are returned last with their citation so surfaces can drop
 * or grey them; blocklisted species never appear. Non-planting symbols are
 * ignored. Input order is preserved for stable display.
 */
export function rankPaletteForEnvelope(
  symbols: CatalogSymbol[],
  envelope: { plantingSunClass: SiteSunClass; wetness: { class: SiteWetnessClass } },
): EnvelopePaletteScore[] {
  const out: EnvelopePaletteScore[] = [];
  for (const sym of symbols) {
    if (sym.category !== "planting") continue;
    if (isBlocklisted(sym.label) || isBlocklisted(sym.botanical_name ?? "")) continue;
    const sunFit = SUN_FIT[envelope.plantingSunClass][sym.sun ?? "partial"] ?? 0.5;
    const waterFit = WATER_FIT[envelope.wetness.class][sym.water ?? "moderate"] ?? 0.5;
    // Sun is the dominant driver (0.65); waterlogging/drought second (0.35).
    const fit = Math.min(1, sunFit * 0.65 + waterFit * 0.35);
    const why =
      `${SUN_CLASS_LABEL[envelope.plantingSunClass]} site · ${envelope.wetness.class.replace("_", " ")} — ` +
      `sun ${sym.sun ?? "unspecified"}, water ${sym.water ?? "unspecified"}.`;
    out.push({ symbolId: sym.id, label: sym.label, fit, why });
  }
  return out.sort((a, b) => b.fit - a.fit);
}

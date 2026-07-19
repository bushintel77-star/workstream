/**
 * Dynamic Volumetric Isolith — bank→loose survey for canvas stockpile HUD.
 * Workflow 1: derives from estimateStudioDrawing quantities (no PostGIS).
 */

import type { StudioEstimateReport } from "./studio-preemptive-estimate";

/** Standard tipper body volume for Isolith truckload readout (m³). */
export const ISOLITH_TRUCK_M3 = 8;

/** Prahran / temperate clay-loam default bulkage (topsoil strip). */
export const BULKAGE_TOPSOIL = 1.25;
/** Mild swell for crushed rock when stockpiled loose. */
export const BULKAGE_CRUSHED_ROCK = 1.15;
/** Spoil swell already used in estimate (excavated clay). */
export const BULKAGE_EXCAVATED_CLAY = 1.6;

/** Topsoil strip depth over disturbed hardscape (m). */
export const TOPSOIL_STRIP_M = 0.1;

export type IsolithMaterialKind =
  | "topsoil"
  | "crushed_rock"
  | "excavated_clay";

export type IsolithGrain = "stipple" | "hatch" | "wave";

export type IsolithMaterial = {
  kind: IsolithMaterialKind;
  label: string;
  bankM3: number;
  bulkageFactor: number;
  bulkageNote: string;
  looseM3: number;
  truckLoads: number;
  grain: IsolithGrain;
  /** 0–1 visual intensity for footprint / ring density. */
  intensity: number;
  depthRuleMm: number;
};

export type IsolithSurvey = {
  materials: IsolithMaterial[];
  /** Preferred pile when several streams exist. */
  primaryKind: IsolithMaterialKind | null;
  totalLooseM3: number;
  honesty: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function intensityFromLoose(looseM3: number): number {
  // ~64 m³ loose → full intensity
  return Math.min(1, Math.sqrt(Math.max(0, looseM3)) / 8);
}

function material(
  kind: IsolithMaterialKind,
  label: string,
  bankM3: number,
  bulkageFactor: number,
  bulkageNote: string,
  grain: IsolithGrain,
  depthRuleMm: number,
): IsolithMaterial | null {
  if (bankM3 < 0.05) return null;
  const bank = round2(bankM3);
  const loose = round2(bank * bulkageFactor);
  return {
    kind,
    label,
    bankM3: bank,
    bulkageFactor,
    bulkageNote,
    looseM3: loose,
    truckLoads: round2(loose / ISOLITH_TRUCK_M3),
    grain,
    intensity: intensityFromLoose(loose),
    depthRuleMm,
  };
}

/** Sum CR6 tonnes from estimate lines → bank m³ at 1.8 t/m³. */
export function crushedRockBankM3FromEstimate(
  report: Pick<StudioEstimateReport, "lines">,
): number {
  const tonnes = report.lines
    .filter((l) => /CR6|crushed rock/i.test(l.label))
    .reduce((s, l) => s + l.qty, 0);
  return tonnes / 1.8;
}

/**
 * Build Isolith material streams from a live studio estimate report.
 */
export function buildIsolithSurvey(
  report: Pick<
    StudioEstimateReport,
    "hardscapeM2" | "excavateM3" | "lines"
  >,
): IsolithSurvey {
  const materials: IsolithMaterial[] = [];

  const topsoil = material(
    "topsoil",
    "Topsoil (stripped)",
    report.hardscapeM2 * TOPSOIL_STRIP_M,
    BULKAGE_TOPSOIL,
    "Clay loam (Prahran default)",
    "stipple",
    100,
  );
  if (topsoil) materials.push(topsoil);

  const crBank = crushedRockBankM3FromEstimate(report);
  const crushed = material(
    "crushed_rock",
    "Crushed rock (CR6)",
    crBank,
    BULKAGE_CRUSHED_ROCK,
    "Compacted base → loose stockpile",
    "hatch",
    150,
  );
  if (crushed) materials.push(crushed);

  const clay = material(
    "excavated_clay",
    "Excavated clay",
    report.excavateM3,
    BULKAGE_EXCAVATED_CLAY,
    "Spoil swell (bank → truck)",
    "wave",
    Math.round(
      report.hardscapeM2 > 0
        ? (report.excavateM3 / report.hardscapeM2) * 1000
        : 180,
    ),
  );
  if (clay) materials.push(clay);

  const primaryKind =
    materials.find((m) => m.kind === "excavated_clay")?.kind ??
    materials.find((m) => m.kind === "topsoil")?.kind ??
    materials[0]?.kind ??
    null;

  return {
    materials,
    primaryKind,
    totalLooseM3: round2(
      materials.reduce((s, m) => s + m.looseM3, 0),
    ),
    honesty: "Indicative bank→loose — confirm soil profile on site",
  };
}

/**
 * Procedural concentric ring radii (outer → inner) as fractions of footprint.
 * Sparse when volume is small; denser / more rings as intensity rises.
 */
export function isolithRingRadii(
  intensity: number,
  maxRings = 7,
): number[] {
  const t = Math.max(0, Math.min(1, intensity));
  const count = Math.max(2, Math.round(2 + t * (maxRings - 2)));
  const outer = 0.98;
  const inner = 0.22 + (1 - t) * 0.18;
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1);
    // Ease inward spacing tighter at high intensity
    const eased = u ** (1 + t * 0.6);
    radii.push(outer - (outer - inner) * eased);
  }
  return radii;
}

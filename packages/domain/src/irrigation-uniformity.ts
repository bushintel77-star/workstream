/**
 * Indicative spray distribution uniformity over authored irrigation zones.
 *
 * Workflow 1 honesty: circular throw, relative precip only — confirm nozzle
 * selection and pressure on site. No hydraulic model, no water-need taxonomy.
 *
 * DU = mean of lowest quartile / overall mean (ASAE-style lower-quartile DU).
 * CU = Christiansen coefficient = 1 − Σ|di − mean| / (n · mean).
 */

import type { IrrigationZone } from "@workstream/contracts";

export type IrrigHead = {
  x: number;
  y: number;
  throwM: number;
  zoneId: string;
};

export type IrrigCellBand = "dry" | "ok" | "wet";

export type IrrigUniformityCell = {
  /** Cell centre in board %. */
  x: number;
  y: number;
  /** Relative precip (unitless sum of head contributions). */
  precip: number;
  band: IrrigCellBand;
};

export type IrrigUniformityReport = {
  heads: IrrigHead[];
  cells: IrrigUniformityCell[];
  /** Lower-quartile distribution uniformity 0–1, null when no coverage. */
  du: number | null;
  /** Christiansen uniformity coefficient 0–1. */
  cu: number | null;
  meanPrecip: number;
  dryCellCount: number;
  wetCellCount: number;
  tip: string;
  scaleM: number;
};

/** Default throw when spacing is absent — ~ half of head-to-head at 3.5 m. */
export const DEFAULT_SPRAY_THROW_M = 1.8;

/** Grid step in metres for the coverage sample. */
const CELL_M = 1.5;

/** Relative precip below this share of mean reads dry. */
const DRY_RATIO = 0.55;

/** Relative precip above this share of mean reads over-watered. */
const WET_RATIO = 1.45;

function pctToM(dPct: number, scaleM: number): number {
  return (dPct / 100) * scaleM;
}

function mToPct(m: number, scaleM: number): number {
  return (m / scaleM) * 100;
}

/**
 * Place heads along a polyline at `spacingM` ground spacing.
 * Mirrors the studio zone tick rhythm so the wash matches what the operator sees.
 */
export function headsAlongPolyline(
  points: Array<{ x: number; y: number }>,
  spacingM: number,
  scaleM: number,
  throwM: number,
  zoneId: string,
): IrrigHead[] {
  if (points.length < 2 || spacingM <= 0 || scaleM <= 0) return [];
  const spacingPct = mToPct(spacingM, scaleM);
  const out: IrrigHead[] = [];
  let carry = 0;
  out.push({
    x: points[0]!.x,
    y: points[0]!.y,
    throwM,
    zoneId,
  });
  for (let i = 1; i < points.length; i += 1) {
    let ax = points[i - 1]!.x;
    let ay = points[i - 1]!.y;
    const b = points[i]!;
    let seg = Math.hypot(b.x - ax, b.y - ay);
    const ux = (b.x - ax) / (seg || 1);
    const uy = (b.y - ay) / (seg || 1);
    while (carry + seg >= spacingPct) {
      const need = spacingPct - carry;
      ax += ux * need;
      ay += uy * need;
      out.push({ x: ax, y: ay, throwM, zoneId });
      seg -= need;
      carry = 0;
    }
    carry += seg;
  }
  return out;
}

function throwForZone(zone: IrrigationZone): number {
  const spacing = zone.fixture_spacing_m;
  if (spacing != null && spacing > 0) {
    // Head-to-head spacing ≈ throw diameter * 0.5…0.6 for square spacing.
    return Math.max(1.2, spacing * 0.55);
  }
  return DEFAULT_SPRAY_THROW_M;
}

function spacingForZone(zone: IrrigationZone): number {
  return zone.fixture_spacing_m != null && zone.fixture_spacing_m > 0
    ? zone.fixture_spacing_m
    : 3.5;
}

/** Soft circular precip contribution — 1 at the head, 0 at throw radius. */
function headPrecip(
  cellX: number,
  cellY: number,
  head: IrrigHead,
  scaleM: number,
): number {
  const distM = pctToM(Math.hypot(cellX - head.x, cellY - head.y), scaleM);
  if (distM >= head.throwM) return 0;
  const t = distM / head.throwM;
  return 1 - t * t;
}

function bandOf(precip: number, mean: number): IrrigCellBand {
  if (mean <= 0) return "dry";
  const r = precip / mean;
  if (r < DRY_RATIO) return "dry";
  if (r > WET_RATIO) return "wet";
  return "ok";
}

function christiansenCu(values: number[], mean: number): number | null {
  if (values.length === 0 || mean <= 0) return null;
  const absDev = values.reduce((s, v) => s + Math.abs(v - mean), 0);
  return Math.max(0, Math.min(1, 1 - absDev / (values.length * mean)));
}

function lowerQuartileDu(values: number[], mean: number): number | null {
  if (values.length === 0 || mean <= 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = Math.max(1, Math.ceil(sorted.length * 0.25));
  const low = sorted.slice(0, n);
  const lowMean = low.reduce((s, v) => s + v, 0) / low.length;
  return Math.max(0, Math.min(1, lowMean / mean));
}

function tipFor(du: number | null, dry: number, wet: number): string {
  if (du == null) {
    return "No spray coverage to sample — draw a spray zone first.";
  }
  if (du < 0.55) {
    return `DU ~${du.toFixed(2)} — dry pockets likely; tighten head spacing or add a run.`;
  }
  if (dry > 0 && wet > 0) {
    return `DU ~${du.toFixed(2)} — ${dry} dry and ${wet} over-watered cells (indicative).`;
  }
  if (dry > 0) {
    return `DU ~${du.toFixed(2)} — ${dry} dry cell(s) at the coverage edge.`;
  }
  if (wet > 0) {
    return `DU ~${du.toFixed(2)} — ${wet} over-watered cell(s) near head clusters.`;
  }
  return `DU ~${du.toFixed(2)} — coverage looks even at this spacing (indicative).`;
}

/**
 * Sample spray-zone coverage on a coarse board grid.
 * Drip / lighting / drain zones are ignored — they are not areal spray.
 */
export function assessIrrigationUniformity(
  zones: IrrigationZone[],
  scaleM: number,
): IrrigUniformityReport {
  const empty: IrrigUniformityReport = {
    heads: [],
    cells: [],
    du: null,
    cu: null,
    meanPrecip: 0,
    dryCellCount: 0,
    wetCellCount: 0,
    tip: tipFor(null, 0, 0),
    scaleM,
  };
  if (!(scaleM > 0)) return empty;

  const spray = zones.filter((z) => (z.kind ?? "drip") === "spray");
  if (spray.length === 0) return empty;

  const heads: IrrigHead[] = [];
  for (const zone of spray) {
    const pts = zone.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
    heads.push(
      ...headsAlongPolyline(
        pts,
        spacingForZone(zone),
        scaleM,
        throwForZone(zone),
        zone.id,
      ),
    );
  }
  if (heads.length === 0) return empty;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of heads) {
    const rPct = mToPct(h.throwM, scaleM);
    minX = Math.min(minX, h.x - rPct);
    minY = Math.min(minY, h.y - rPct);
    maxX = Math.max(maxX, h.x + rPct);
    maxY = Math.max(maxY, h.y + rPct);
  }
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(100, maxX);
  maxY = Math.min(100, maxY);

  const stepPct = mToPct(CELL_M, scaleM);
  const cells: IrrigUniformityCell[] = [];
  const precipValues: number[] = [];

  for (let y = minY; y <= maxY + 1e-9; y += stepPct) {
    for (let x = minX; x <= maxX + 1e-9; x += stepPct) {
      let precip = 0;
      for (const h of heads) precip += headPrecip(x, y, h, scaleM);
      if (precip <= 0) continue;
      precipValues.push(precip);
      cells.push({ x, y, precip, band: "ok" });
    }
  }

  if (precipValues.length === 0) return { ...empty, heads };

  const mean =
    precipValues.reduce((s, v) => s + v, 0) / precipValues.length;
  let dryCellCount = 0;
  let wetCellCount = 0;
  for (const c of cells) {
    c.band = bandOf(c.precip, mean);
    if (c.band === "dry") dryCellCount += 1;
    if (c.band === "wet") wetCellCount += 1;
  }

  const du = lowerQuartileDu(precipValues, mean);
  const cu = christiansenCu(precipValues, mean);

  return {
    heads,
    cells,
    du,
    cu,
    meanPrecip: mean,
    dryCellCount,
    wetCellCount,
    tip: tipFor(du, dryCellCount, wetCellCount),
    scaleM,
  };
}

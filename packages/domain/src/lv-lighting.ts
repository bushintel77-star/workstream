/**
 * Low-voltage landscape lighting — load + voltage-drop model (Workflow 1).
 * Indicative engineering for the lighting workspace; confirm with electrician.
 *
 * Spec: wattage × 1.2 design load; transformer 80% rule; 12/2 | 14/2 drop.
 */

import { isLightingSymbolId } from "./landscape-services";

export type LvWireGauge = "12/2" | "14/2";

/** Ohms per metre of conductor pair (indicative copper). */
const OHMS_PER_M: Record<LvWireGauge, number> = {
  "12/2": 0.0052,
  "14/2": 0.0083,
};

/** Nominal fixture watts by catalog symbol — house defaults. */
const FIXTURE_WATTS: Record<string, number> = {
  "brass-uplight": 7,
  "brass-bollard-light": 5,
  "path-spike-light": 4,
  "wall-wash-light": 8,
  "led-graze-tape": 12,
  "deck-strip-light": 10,
  "underwater-pool-light": 15,
};

/** Photometric beam half-angle (deg) for cone render — indicative. */
const FIXTURE_BEAM_DEG: Record<string, number> = {
  "brass-uplight": 28,
  "brass-bollard-light": 45,
  "path-spike-light": 55,
  "wall-wash-light": 40,
  "led-graze-tape": 70,
  "deck-strip-light": 80,
  "underwater-pool-light": 35,
};

export const DEFAULT_TRANSFORMER_VA = 200;
export const DEFAULT_WIRE_GAUGE: LvWireGauge = "12/2";
export const DEFAULT_KELVIN = 2700;
/** Max continuous load fraction of transformer VA. */
export const TRANSFORMER_LOAD_FRACTION = 0.8;
/** Design multiplier on fixture wattage. */
export const DESIGN_LOAD_FACTOR = 1.2;
/** Nominal LV circuit voltage. */
export const LV_VOLTS = 12;

export type LvFixtureInput = {
  id: string;
  symbolId: string;
  x: number;
  y: number;
  /** Optional rotation deg — beam aim. */
  rot?: number;
};

export type LvCircuitInput = {
  fixtures: LvFixtureInput[];
  /** Total one-way cable run length (m) — lighting + conduit polylines. */
  runLengthM: number;
  transformerVa?: number;
  wireGauge?: LvWireGauge;
};

export type LvCircuitAssessment = {
  fixtureCount: number;
  connectedWatts: number;
  designLoadW: number;
  transformerVa: number;
  capacityW: number;
  loadFraction: number;
  overloaded: boolean;
  headroomW: number;
  wireGauge: LvWireGauge;
  runLengthM: number;
  voltageDropV: number;
  voltageDropPct: number;
  /** Drop above ~5% of 12 V — soft warn. */
  dropWarn: boolean;
  tip: string;
};

export function fixtureWattage(symbolId: string): number {
  return FIXTURE_WATTS[symbolId] ?? (isLightingSymbolId(symbolId) ? 6 : 0);
}

export function fixtureBeamDeg(symbolId: string): number {
  return FIXTURE_BEAM_DEG[symbolId] ?? 40;
}

export function kelvinToCss(kelvin: number): string {
  const k = Math.max(2200, Math.min(4000, kelvin));
  // Warm → cool within landscape LV range.
  const t = (k - 2200) / (4000 - 2200);
  const r = Math.round(255);
  const g = Math.round(210 + t * 30);
  const b = Math.round(140 + t * 90);
  return `rgb(${r} ${g} ${b})`;
}

/**
 * Path length in metres from board-% polyline and site width (m).
 * Same scale assumption as Fit sheet / zone BOM (width maps to 100%).
 */
export function polylineLengthM(
  points: Array<{ x: number; y: number }>,
  boardWidthM: number,
): number {
  if (points.length < 2 || !(boardWidthM > 0)) return 0;
  const ppm = 100 / boardWidthM;
  let m = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    m += Math.hypot(b.x - a.x, b.y - a.y) / ppm;
  }
  return m;
}

export function assessLvCircuit(input: LvCircuitInput): LvCircuitAssessment {
  const transformerVa = input.transformerVa ?? DEFAULT_TRANSFORMER_VA;
  const wireGauge = input.wireGauge ?? DEFAULT_WIRE_GAUGE;
  const runLengthM = Math.max(0, input.runLengthM);
  const fixtures = input.fixtures.filter((f) => isLightingSymbolId(f.symbolId));
  const connectedWatts = fixtures.reduce(
    (s, f) => s + fixtureWattage(f.symbolId),
    0,
  );
  const designLoadW = connectedWatts * DESIGN_LOAD_FACTOR;
  const capacityW = transformerVa * TRANSFORMER_LOAD_FRACTION;
  const loadFraction = capacityW > 0 ? designLoadW / capacityW : 0;
  const overloaded = designLoadW > capacityW + 1e-6;
  const headroomW = Math.max(0, capacityW - designLoadW);

  // Vdrop ≈ I × R; I = designLoad / V; R = ohms/m × 2-way length.
  const amps = designLoadW > 0 ? designLoadW / LV_VOLTS : 0;
  const ohms = OHMS_PER_M[wireGauge] * runLengthM * 2;
  const voltageDropV = amps * ohms;
  const voltageDropPct =
    LV_VOLTS > 0 ? (voltageDropV / LV_VOLTS) * 100 : 0;
  const dropWarn = voltageDropPct > 5;

  let tip: string;
  if (fixtures.length === 0) {
    tip = "Place fixtures or draw a lighting run to size the transformer.";
  } else if (overloaded) {
    const nextVa = transformerVa <= 150 ? 200 : transformerVa <= 200 ? 300 : 600;
    tip = `Over 80% of ${transformerVa} VA — upgrade to ${nextVa} VA or split the circuit.`;
  } else if (dropWarn) {
    tip =
      wireGauge === "14/2"
        ? "Voltage drop >5% — step up to 12/2 or shorten the run."
        : "Voltage drop >5% — shorten the run or add a second transformer.";
  } else {
    tip = `${Math.round(headroomW)} W headroom on ${transformerVa} VA · ${wireGauge}.`;
  }

  return {
    fixtureCount: fixtures.length,
    connectedWatts,
    designLoadW,
    transformerVa,
    capacityW,
    loadFraction,
    overloaded,
    headroomW,
    wireGauge,
    runLengthM,
    voltageDropV,
    voltageDropPct,
    dropWarn,
    tip,
  };
}

/** Suggest next transformer VA rung when overloaded. */
export function nextTransformerVa(current: number): number {
  if (current < 150) return 150;
  if (current < 200) return 200;
  if (current < 300) return 300;
  if (current < 600) return 600;
  return current;
}

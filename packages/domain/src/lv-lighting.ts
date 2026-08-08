/**
 * Low-voltage landscape lighting — load + voltage-drop model (Workflow 1).
 * Indicative engineering for the lighting workspace; confirm with electrician.
 *
 * Spec: wattage × 1.2 design load; transformer 80% rule; 12/2 | 14/2 drop;
 * spline wire theatre + pulse only the offending run(s).
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
/** Assign a fixture to a lighting run within this board distance (m). */
export const LV_FIXTURE_ASSIGN_RADIUS_M = 4;

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

export type LvRunZone = {
  id: string;
  kind: "lighting" | "lighting_conduit";
  points: Array<{ x: number; y: number }>;
  wire_gauge?: LvWireGauge;
  transformer_va?: number;
};

export type LvRunsAssessment = {
  aggregate: LvCircuitAssessment;
  runs: Array<{ zoneId: string; assessment: LvCircuitAssessment }>;
  /** Zone ids whose cable should pulse — overloaded lighting runs (+ conduits when aggregate overloads). */
  overloadedZoneIds: string[];
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

/** Min distance in board % from a point to a polyline. */
export function distPointToPolylinePct(
  p: { x: number; y: number },
  pts: Array<{ x: number; y: number }>,
): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) {
    return Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y);
  }
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    best = Math.min(best, Math.hypot(p.x - qx, p.y - qy));
  }
  return best;
}

/**
 * Catmull-Rom → cubic Bezier SVG path through board-% control points.
 * Stored geometry stays a polyline; this is presentation only.
 */
export function catmullRomSvgPath(
  pts: Array<{ x: number; y: number }>,
): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
  if (pts.length === 2) {
    return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`;
  }
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? i : i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
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

/**
 * Per-run assessments so only overloaded lighting cables pulse.
 * Fixtures assign to the nearest `lighting` run within assignRadiusM.
 * Conduit runs pulse when the aggregate circuit is overloaded (house feed).
 */
export function assessLvRuns(input: {
  zones: LvRunZone[];
  fixtures: LvFixtureInput[];
  boardWidthM: number;
  defaultTransformerVa?: number;
  defaultWireGauge?: LvWireGauge;
  assignRadiusM?: number;
}): LvRunsAssessment {
  const boardW = input.boardWidthM > 0 ? input.boardWidthM : 110;
  const assignR = input.assignRadiusM ?? LV_FIXTURE_ASSIGN_RADIUS_M;
  const assignPct = (assignR / boardW) * 100;
  const defVa = input.defaultTransformerVa ?? DEFAULT_TRANSFORMER_VA;
  const defGauge = input.defaultWireGauge ?? DEFAULT_WIRE_GAUGE;

  const lightingRuns = input.zones.filter((z) => z.kind === "lighting");
  const conduitRuns = input.zones.filter((z) => z.kind === "lighting_conduit");
  const fixtures = input.fixtures.filter((f) =>
    isLightingSymbolId(f.symbolId),
  );

  const assigned = new Map<string, LvFixtureInput[]>();
  for (const z of lightingRuns) assigned.set(z.id, []);
  const orphan: LvFixtureInput[] = [];

  for (const f of fixtures) {
    let bestId: string | null = null;
    let bestD = Infinity;
    for (const z of lightingRuns) {
      const d = distPointToPolylinePct(f, z.points);
      if (d < bestD) {
        bestD = d;
        bestId = z.id;
      }
    }
    if (bestId != null && bestD <= assignPct) {
      assigned.get(bestId)!.push(f);
    } else {
      orphan.push(f);
    }
  }

  // Orphans ride the longest lighting run, else stay aggregate-only.
  if (orphan.length > 0 && lightingRuns.length > 0) {
    let longest = lightingRuns[0]!;
    let longestM = polylineLengthM(longest.points, boardW);
    for (const z of lightingRuns.slice(1)) {
      const m = polylineLengthM(z.points, boardW);
      if (m > longestM) {
        longest = z;
        longestM = m;
      }
    }
    assigned.get(longest.id)!.push(...orphan);
  }

  const runs: LvRunsAssessment["runs"] = [];
  const overloadedZoneIds: string[] = [];

  for (const z of lightingRuns) {
    const assessment = assessLvCircuit({
      fixtures: assigned.get(z.id) ?? [],
      runLengthM: polylineLengthM(z.points, boardW),
      transformerVa: z.transformer_va ?? defVa,
      wireGauge: z.wire_gauge ?? defGauge,
    });
    runs.push({ zoneId: z.id, assessment });
    if (assessment.overloaded) overloadedZoneIds.push(z.id);
  }

  const totalLen = input.zones.reduce(
    (s, z) => s + polylineLengthM(z.points, boardW),
    0,
  );
  const aggregate = assessLvCircuit({
    fixtures,
    runLengthM: totalLen,
    transformerVa: defVa,
    wireGauge: defGauge,
  });

  // House feed pulses when the whole board circuit is over — or when any
  // lighting run is over.
  if (aggregate.overloaded || overloadedZoneIds.length > 0) {
    for (const z of conduitRuns) {
      if (!overloadedZoneIds.includes(z.id)) overloadedZoneIds.push(z.id);
    }
  }

  return { aggregate, runs, overloadedZoneIds };
}

/** Suggest next transformer VA rung when overloaded. */
export function nextTransformerVa(current: number): number {
  if (current < 150) return 150;
  if (current < 200) return 200;
  if (current < 300) return 300;
  if (current < 600) return 600;
  return current;
}

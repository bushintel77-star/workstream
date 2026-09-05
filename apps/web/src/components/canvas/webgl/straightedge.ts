/**
 * Straightedge — the Trace ruler as a rail tool (gap-analysis Phase 1,
 * docs/MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md §5).
 *
 * The operator places an edge with the RULE tool, then draws along it with
 * the PEN. Drawing law (assist, never constrain — strokeAssist.ts's rule,
 * which this module extends): a raw draw point NEAR the placed edge
 * projects onto it (the ink reads as a ruler line); a point beyond the
 * proximity band stays freehand. The edge is drawn geometric truth while
 * it lives, and the live length reads through the existing LiveNibReadout
 * channel (`rulerM` on liveCoord).
 *
 * The edge is stored in board-% like every other spatial contract (the
 * square board, aspect 1 by law, makes % ↔ m a single linear scale), and
 * all distance math happens in WORLD METRES via pctToWorld — projection
 * proximity and along-edge length are physical quantities, not pixel
 * quantities.
 *
 * Title-boundary reconciliation (AGENTS.md standing rule): the straightedge
 * is a session drawing aid, NOT a physically sited artifact — like the
 * marquee box or the draft rubber band, it persists nothing and represents
 * nothing on the ground. No reconciliation event applies; committed INK
 * drawn along it is ordinary ink and follows the existing converters.
 *
 * Scope note: the constraint rides the ground draw path only (Phase 1 2D
 * fluency). Strokes on sketch-canvas planes keep the freehand + hold-
 * straighten assists; per-plane rulers are the Phase 2 per-plane work.
 */

import { pctToWorld, type PctPoint } from "./coordTransform";

export interface Straightedge {
  a: PctPoint;
  b: PctPoint;
}

/**
 * How close the pen must come to the edge before it captures, as a fraction
 * of the board's metre scale. 1.5% ≈ 1.65 m on a 110 m board — about a
 * pencil's width at studio zoom, wide enough that drawing "against the
 * ruler" captures without hunting.
 */
export const STRAIGHTEDGE_PROXIMITY_PCT = 1.5;

/** Below this edge length (world m) a placement drag is a click, not a ruler. */
export const STRAIGHTEDGE_MIN_LENGTH_M = 0.5;

export interface EdgeProjection {
  /** The captured point, exactly on the edge (world metres, XZ). */
  x: number;
  z: number;
  /** Metres along the edge from end a to the captured point. */
  alongM: number;
  /** The edge's total length in metres. */
  edgeLengthM: number;
  /** Distance the raw point sat off the edge (metres) — readout diagnostics. */
  offM: number;
}

function toWorldM(p: PctPoint, scaleM: number, boardAspect: number): { x: number; z: number } {
  const [x, z] = pctToWorld(p, scaleM, boardAspect);
  return { x, z };
}

/** Edge length in world metres. */
export function straightedgeLengthM(
  edge: Straightedge,
  scaleM: number,
  boardAspect: number,
): number {
  const a = toWorldM(edge.a, scaleM, boardAspect);
  const b = toWorldM(edge.b, scaleM, boardAspect);
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Project a world-space draw point onto the edge segment (clamped to the
 * ruler's extent — a ruler does not extend itself). Returns null when the
 * point is beyond the proximity band: the stroke stays freehand there.
 * Pure in the caller's space — `x`/`z` are world metres today.
 */
export function projectOntoStraightedge(
  raw: { x: number; z: number },
  edge: Straightedge,
  scaleM: number,
  boardAspect: number,
  opts?: { proximityM?: number },
): EdgeProjection | null {
  const a = toWorldM(edge.a, scaleM, boardAspect);
  const b = toWorldM(edge.b, scaleM, boardAspect);
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthM = Math.hypot(abx, abz);
  if (lengthM === 0) return null;

  // Parametric position of the raw point along the infinite line, clamped
  // to [0,1] so the capture is the SEGMENT, not the line.
  const tRaw = ((raw.x - a.x) * abx + (raw.z - a.z) * abz) / (lengthM * lengthM);
  const t = Math.max(0, Math.min(1, tRaw));
  const x = a.x + abx * t;
  const z = a.z + abz * t;
  const offM = Math.hypot(raw.x - x, raw.z - z);

  const proximityM =
    opts?.proximityM ?? (scaleM * STRAIGHTEDGE_PROXIMITY_PCT) / 100;
  if (offM > proximityM) return null;

  return { x, z, alongM: t * lengthM, edgeLengthM: lengthM, offM };
}

/** `12.4` / `0.8` — metres with one decimal (stationing's formatMetres reads
 *  whole boards; a ruler segment needs the decimal to feel calibrated). */
export function formatRulerMetres(m: number): string {
  return m.toFixed(1);
}

/**
 * Stroke assist — the Trace drawing fluency primitives (gap-analysis
 * Phase 1, docs/MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md).
 *
 * Assist, never constrain (Trace's interaction law): the stroke is always
 * the operator's; these modules tidy it. Both are pure functions over
 * {x, y} planar points so they are unit-testable and space-agnostic — the
 * caller stabilizes/straightens in the same space the stroke is stored in
 * (world metres today; the modules never learn about THREE).
 */

/**
 * Pull-chain stabilizer (the "smooth curves" slider in Trace's terms).
 *
 * Each accepted raw point is pulled toward the previous STABILIZED point
 * before it joins the stroke: `next = last + (raw - last) × follow`, where
 * `follow = 1 − strength×0.85`. At strength 0 the point passes through
 * untouched (today's behaviour, byte-for-byte); at 1 it is heavily damped
 * but never frozen — the chain still reaches the pen, just late and calm.
 * Wobble dies because the chain averages it out; corners survive because
 * the operator slows into them, which is exactly when the chain catches up.
 */
export interface StabilizerState {
  last: { x: number; y: number } | null;
}

/** How much of the raw offset survives at maximum strength (never freeze). */
const FOLLOW_FLOOR = 0.15;

export function stabilizePoint(
  raw: { x: number; y: number },
  state: StabilizerState,
  strength: number,
): { x: number; y: number } {
  const s = Math.max(0, Math.min(1, strength));
  if (s === 0 || !state.last) {
    state.last = { x: raw.x, y: raw.y };
    return { x: raw.x, y: raw.y };
  }
  const follow = 1 - s * (1 - FOLLOW_FLOOR);
  const next = {
    x: state.last.x + (raw.x - state.last.x) * follow,
    y: state.last.y + (raw.y - state.last.y) * follow,
  };
  state.last = next;
  return next;
}

/** Pen-hold threshold — how still the pen must sit before lift to
 *  straighten (Trace's "Hold to Straighten Line" preference). */
export const STRAIGHTEN_HOLD_MS = 400;

/** Minimum chord/path ratio — a scrawl must NOT snap to a ruler. */
export const STRAIGHTEN_MIN_STRAIGHTNESS = 0.6;

/**
 * Should this stroke straighten on lift? Three gates, all required:
 *  - the pen held still ≥ STRAIGHTEN_HOLD_MS before lift (a deliberate
 *    hold, not a lift mid-flow);
 *  - at least 2 points and some length;
 *  - the stroke was already line-INTENDING (straightness ≥ 0.6) — a curve
 *    that pauses stays a curve.
 */
export function shouldStraighten(
  points: ReadonlyArray<{ x: number; y: number }>,
  heldMs: number,
  opts?: { holdMs?: number },
): boolean {
  const holdMs = opts?.holdMs ?? STRAIGHTEN_HOLD_MS;
  if (heldMs < holdMs) return false;
  if (points.length < 2) return false;
  return straightness(points) >= STRAIGHTEN_MIN_STRAIGHTNESS;
}

/**
 * Straighten to the chord (first → last point), optionally snapping the
 * chord to the nearest 15° increment when it is within `snapToleranceDeg`
 * of one. The snap rotates the END around the START, preserving length.
 * Returns exactly two points — the honest straight line.
 */
export const STRAIGHTEN_SNAP_STEP_DEG = 15;
export const STRAIGHTEN_SNAP_TOLERANCE_DEG = 5;

export function straightenStroke(
  points: ReadonlyArray<{ x: number; y: number }>,
  opts?: { snapStepDeg?: number; snapToleranceDeg?: number },
): Array<{ x: number; y: number }> {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const stepDeg = opts?.snapStepDeg ?? STRAIGHTEN_SNAP_STEP_DEG;
  const tolDeg = opts?.snapToleranceDeg ?? STRAIGHTEN_SNAP_TOLERANCE_DEG;

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [{ ...first }, { ...last }];

  const angleRad = Math.atan2(dy, dx);
  const stepRad = (stepDeg * Math.PI) / 180;
  const tolRad = (tolDeg * Math.PI) / 180;
  const nearest = Math.round(angleRad / stepRad) * stepRad;
  const snapped =
    Math.abs(angleRad - nearest) <= tolRad ? nearest : angleRad;

  return [
    { x: first.x, y: first.y },
    {
      x: first.x + Math.cos(snapped) * len,
      y: first.y + Math.sin(snapped) * len,
    },
  ];
}

/** Chord length ÷ path length. 1 = perfectly straight. */
export function straightness(
  points: ReadonlyArray<{ x: number; y: number }>,
): number {
  if (points.length < 2) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  let path = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    path += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (path <= 0) return 0;
  return chord / path;
}

import type { PctPoint } from "./types";

const CLOSE_SNAP_PCT = 1.2;

/** Ensure a closed ring ends on the first vertex (for hatch / Turf). */
export function closeSurveyRing(ring: PctPoint[]): PctPoint[] {
  if (ring.length < 3) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (Math.hypot(a.x - b.x, a.y - b.y) < CLOSE_SNAP_PCT) {
    return [...ring.slice(0, -1), { x: a.x, y: a.y }];
  }
  return [...ring, { x: a.x, y: a.y }];
}

/**
 * Survey Servc tool honesty:
 * - ≥3 pts → closed easement polygon (hatch + Turf exclude)
 * - 2 pts → open service corridor polyline
 */
export function classifySurveyCorridor(
  ring: PctPoint[],
): { kind: "easement"; ring: PctPoint[] } | { kind: "service"; ring: PctPoint[] } | null {
  if (ring.length < 2) return null;
  if (ring.length >= 3) {
    return { kind: "easement", ring: closeSurveyRing(ring) };
  }
  return { kind: "service", ring };
}

/** True when a click is near the first vertex (operator closing the easement). */
export function nearSurveyRingStart(
  ring: PctPoint[],
  p: PctPoint,
  snapPct = CLOSE_SNAP_PCT,
): boolean {
  if (ring.length < 2) return false;
  const a = ring[0]!;
  return Math.hypot(a.x - p.x, a.y - p.y) <= snapPct;
}

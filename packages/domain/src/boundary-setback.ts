import type { TracePoint } from "./trace-autocomplete";

export const DEFAULT_SETBACK_M = 1.5;

/** Inward offset ring from parcel vertices (indicative council setback). */
export function inwardSetbackRing(
  points: TracePoint[],
  setbackM = DEFAULT_SETBACK_M,
): TracePoint[] {
  if (points.length < 3 || setbackM <= 0) return [];
  const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
  const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: p.x - (dx / len) * setbackM,
      y: p.y - (dy / len) * setbackM,
    };
  });
}

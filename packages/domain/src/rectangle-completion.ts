/** Percent-space point used by canvas / MapLibre overlays. */
export type PctPoint = { x: number; y: number };

/**
 * Infer a rectangle closure from an in-progress polygon trace.
 * - 2 points + cursor: project a perpendicular offset from the current segment.
 * - 3 points: complete the parallelogram (4th = p0 + (p2 - p1)).
 * Returns null when the offset is too small to be a meaningful rectangle.
 */
export function inferRectangleCompletion(
  points: PctPoint[],
  cursor: PctPoint | null = null,
  minOffsetPct = 1.5,
): PctPoint[] | null {
  if (points.length === 2 && cursor) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    const vx = p1.x - p0.x;
    const vy = p1.y - p0.y;
    const vlen = Math.hypot(vx, vy) || 1;
    const nx = -vy / vlen;
    const ny = vx / vlen;
    const w = (cursor.x - p1.x) * nx + (cursor.y - p1.y) * ny;
    if (Math.abs(w) < minOffsetPct) return null;
    const p2 = { x: p1.x + nx * w, y: p1.y + ny * w };
    const p3 = { x: p0.x + nx * w, y: p0.y + ny * w };
    return [p0, p1, p2, p3];
  }
  if (points.length === 3) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    const p2 = points[2]!;
    const p3 = { x: p0.x + (p2.x - p1.x), y: p0.y + (p2.y - p1.y) };
    return [p0, p1, p2, p3];
  }
  return null;
}

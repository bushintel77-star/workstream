export type TracePoint = { x: number; y: number };

/**
 * Infer a rectangle closure from an in-progress trace (Design Studio v5).
 * Works in any planar unit (canvas %, lot metres, px) — pass a matching minWidth.
 */
export function inferRectangleCompletion(
  draft: TracePoint[],
  cursor: TracePoint | null,
  minWidth = 8,
): TracePoint[] | null {
  if (draft.length === 3) {
    const p0 = draft[0]!;
    const p1 = draft[1]!;
    const p2 = draft[2]!;
    const p3 = { x: p0.x + (p2.x - p1.x), y: p0.y + (p2.y - p1.y) };
    return [p0, p1, p2, p3];
  }
  if (draft.length === 2 && cursor) {
    const p0 = draft[0]!;
    const p1 = draft[1]!;
    const vx = p1.x - p0.x;
    const vy = p1.y - p0.y;
    const vlen = Math.hypot(vx, vy) || 1;
    const ux = vx / vlen;
    const uy = vy / vlen;
    const nx = -uy;
    const ny = ux;
    const w = (cursor.x - p1.x) * nx + (cursor.y - p1.y) * ny;
    if (Math.abs(w) < minWidth) return null;
    const p2 = { x: p1.x + nx * w, y: p1.y + ny * w };
    const p3 = { x: p0.x + nx * w, y: p0.y + ny * w };
    return [p0, p1, p2, p3];
  }
  return null;
}

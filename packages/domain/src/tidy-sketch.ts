/**
 * Hand-drawn tidy — smooth jitter while staying honest to the artist's path.
 * Does NOT map strokes onto the CAD symbol library.
 */

export type SketchPoint = { x: number; y: number };

/** Chaikin corner-cutting — one pass softens without erasing intent. */
function chaikin(points: SketchPoint[], iterations = 1): SketchPoint[] {
  let pts = points;
  for (let n = 0; n < iterations; n++) {
    if (pts.length < 3) return pts;
    const next: SketchPoint[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      next.push(
        { x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
        { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y },
      );
    }
    next.push(pts[pts.length - 1]!);
    pts = next;
  }
  return pts;
}

/** Resample roughly evenly along the polyline (keeps first/last). */
function resample(points: SketchPoint[], spacing = 1.2): SketchPoint[] {
  if (points.length < 2) return points;
  const out: SketchPoint[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let seg = Math.hypot(dx, dy);
    if (seg < 1e-6) continue;
    let t = (spacing - carry) / seg;
    while (t <= 1) {
      out.push({ x: a.x + dx * t, y: a.y + dy * t });
      t += spacing / seg;
    }
    carry = seg - spacing * Math.floor((seg + carry) / spacing);
    if (carry < 0) carry = 0;
  }
  const last = points[points.length - 1]!;
  const tip = out[out.length - 1]!;
  if (Math.hypot(tip.x - last.x, tip.y - last.y) > 0.05) out.push(last);
  return out;
}

/**
 * Tidy a freehand stroke in % board space — hand-drawn honesty, not CAD glyphs.
 */
export function tidySketchPoints(points: SketchPoint[]): SketchPoint[] {
  if (points.length < 3) return points;
  const soft = chaikin(points, 2);
  return resample(soft, 0.9);
}

export function tidySketchStrokes<T extends { points: SketchPoint[] }>(
  strokes: T[],
): T[] {
  return strokes.map((s) => ({
    ...s,
    points: tidySketchPoints(s.points),
  }));
}

type XY = { x: number; y: number };

export type Bbox = { minX: number; maxX: number; minY: number; maxY: number };

const EPS = 1e-9;
/** Cap miter growth at sharp joins (~2.9× half-width, ≈ 40° interior angle). */
const MITER_LIMIT = 2.9;

function dedupe(points: XY[]): XY[] {
  const out: XY[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) {
      continue;
    }
    out.push(p);
  }
  return out;
}

/** Unit left-hand normal of segment a→b, or null when degenerate. */
function segmentNormal(a: XY, b: XY): XY | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: -dy / len, y: dx / len };
}

/** Liang-Barsky clip of segment a→b against a bbox. Null when fully outside. */
function clipSegment(a: XY, b: XY, box: Bbox): [XY, XY] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, a.x - box.minX],
    [dx, box.maxX - a.x],
    [-dy, a.y - box.minY],
    [dy, box.maxY - a.y],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < EPS) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}

/**
 * Clip a polyline to a bbox, splitting into continuous runs where the line
 * exits and re-enters. Vicmap easement lines run whole street blocks — clip
 * them to the lot frame in metre space before buffering, otherwise the
 * projected corridor sweeps across the wrong part of the board.
 */
export function clipPolylineToBbox(points: XY[], box: Bbox): XY[][] {
  const pts = dedupe(points);
  const runs: XY[][] = [];
  let current: XY[] | null = null;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const clipped = clipSegment(pts[i]!, pts[i + 1]!, box);
    if (!clipped) {
      current = null;
      continue;
    }
    const [s, e] = clipped;
    const prev = current?.[current.length - 1];
    if (
      prev &&
      Math.abs(prev.x - s.x) < 1e-6 &&
      Math.abs(prev.y - s.y) < 1e-6
    ) {
      current!.push(e);
    } else {
      current = [s, e];
      runs.push(current);
    }
    // Segment was cut short on exit — the next one starts a new run.
    if (Math.abs(e.x - pts[i + 1]!.x) > 1e-6 || Math.abs(e.y - pts[i + 1]!.y) > 1e-6) {
      current = null;
    }
  }
  return runs.filter(
    (run) => run.length >= 2 && dedupe(run).length >= 2,
  );
}

/**
 * Buffer an open polyline into a closed corridor ring: each vertex is offset
 * `halfWidth` to both sides along the miter direction, then the two offset
 * chains are stitched (left side out, right side back).
 *
 * Works in any planar space — Vicmap easement centrelines are buffered in
 * canvas metres (0.9 m each side → 1.8 m corridor) before the % projection.
 */
export function bufferPolylineToRing(points: XY[], halfWidth: number): XY[] {
  const pts = dedupe(points);
  if (pts.length < 2 || halfWidth <= 0) return [];

  const left: XY[] = [];
  const right: XY[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const before = i > 0 ? segmentNormal(pts[i - 1]!, pts[i]!) : null;
    const after =
      i < pts.length - 1 ? segmentNormal(pts[i]!, pts[i + 1]!) : null;
    const n =
      before && after
        ? { x: before.x + after.x, y: before.y + after.y }
        : (before ?? after);
    if (!n) return [];
    const len = Math.hypot(n.x, n.y);
    if (len < EPS) {
      // 180° reversal — fall back to the incoming segment's normal.
      const fallback = before ?? after!;
      left.push({
        x: pts[i]!.x + fallback.x * halfWidth,
        y: pts[i]!.y + fallback.y * halfWidth,
      });
      right.push({
        x: pts[i]!.x - fallback.x * halfWidth,
        y: pts[i]!.y - fallback.y * halfWidth,
      });
      continue;
    }
    const unit = { x: n.x / len, y: n.y / len };
    // Miter scale = 1 / cos(θ/2); dot(unit, segment normal) is cos(θ/2).
    const cosHalf = before
      ? unit.x * before.x + unit.y * before.y
      : unit.x * after!.x + unit.y * after!.y;
    const scale = Math.min(MITER_LIMIT, 1 / Math.max(1 / MITER_LIMIT, cosHalf));
    const off = halfWidth * scale;
    left.push({ x: pts[i]!.x + unit.x * off, y: pts[i]!.y + unit.y * off });
    right.push({ x: pts[i]!.x - unit.x * off, y: pts[i]!.y - unit.y * off });
  }

  return [...left, ...right.reverse()];
}

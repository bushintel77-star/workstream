/**
 * Phase M.3/M.4 — lay a dash signature along a polyline.
 *
 * Semantic markup materials carry a MANDATORY dash signature (spec §8c): a
 * setback, a gas run, a services run and a survey line have to stay apart
 * from each other in greyscale and under colour-blind review, and colour
 * alone cannot do that. The signatures are arbitrary-length patterns —
 * `gas` is dash-dot, `[18, 7, 3, 7]` — so they cannot be expressed by a
 * renderer that only knows dashSize/gapSize. This walks the line by arc
 * length and emits the "on" runs as explicit segments, which renders the
 * real signature rather than an approximation of it.
 *
 * Pure and unit-tested: the dash pattern is a drawing convention, and a
 * convention that silently drifts is a convention nobody can rely on.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.3 / M.4.
 */

export type Vec3 = [number, number, number];

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function distance(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Split a polyline into the "on" runs of a dash pattern.
 *
 * @param points  The polyline, in world units.
 * @param pattern Alternating on/off lengths in the SAME units as `points`
 *                (`[on, off, on, off, ...]`). An empty pattern means a solid
 *                line — the whole polyline comes back as one run.
 * @returns       Runs of points; each run is a contiguous drawn piece.
 */
export function dashPolyline(points: Vec3[], pattern: number[]): Vec3[][] {
  if (points.length < 2) return [];
  const usable = pattern.filter((n) => Number.isFinite(n) && n > 0);
  // A solid line, and the guard that keeps a zero-length or malformed
  // pattern from looping forever below.
  if (usable.length === 0) return [points.map((p) => [...p] as Vec3)];

  const runs: Vec3[][] = [];
  let current: Vec3[] | null = [points[0]!];
  let patternIdx = 0;
  // Even indices are "on", odd are "off". A pattern with an odd length
  // alternates phase on each repeat, which is how dash-dot signatures are
  // conventionally drawn.
  let remaining = usable[0]!;
  let on = true;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const segLen = distance(from, to);
    if (segLen === 0) continue;
    let t0 = 0;

    while (segLen - t0 * segLen > remaining) {
      const t = t0 + remaining / segLen;
      const cut = lerp(from, to, t);
      if (on) {
        current!.push(cut);
        runs.push(current!);
        current = null;
      } else {
        current = [cut];
      }
      on = !on;
      patternIdx = (patternIdx + 1) % usable.length;
      remaining = usable[patternIdx]!;
      t0 = t;
    }

    remaining -= segLen * (1 - t0);
    if (on) current!.push([...to] as Vec3);
  }

  if (on && current && current.length >= 2) runs.push(current);
  return runs;
}

/**
 * Flatten dash runs into the point pairs a segment renderer wants
 * (`LineSegments2` / drei `<Line segments>`): every consecutive pair inside
 * a run becomes its own two-point segment.
 */
export function dashRunsToSegments(runs: Vec3[][]): Vec3[] {
  const out: Vec3[] = [];
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) {
      out.push(run[i - 1]!, run[i]!);
    }
  }
  return out;
}

/** Total drawn length of a set of runs — used by the tests to prove the
 *  signature covers the duty cycle the pattern asks for. */
export function drawnLength(runs: Vec3[][]): number {
  let total = 0;
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) total += distance(run[i - 1]!, run[i]!);
  }
  return total;
}

/** Total length of a polyline. */
export function polylineLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1]!, points[i]!);
  return total;
}

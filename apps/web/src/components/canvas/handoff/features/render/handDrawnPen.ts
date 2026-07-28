/**
 * Freehand CAD pencil — deterministic wobble over board-% polylines.
 * Uses seededRandom so a given plan redraws identically (honesty).
 */

import { seededRandom } from "./seededRandom";
import type { PctPoint } from "../../geometry/types";

export type HandDrawnOpts = {
  /** Seed key — typically projectId + ring role. */
  seed: string;
  /** Lateral wobble as a fraction of segment length (default 0.018). */
  amplitude?: number;
  /** Extra samples per segment (default 2). */
  subdivisions?: number;
  /** Force a closed path (title rings often omit the repeated first vertex). */
  closed?: boolean;
};

/**
 * Convert a closed or open %-ring into an SVG path with seeded pencil wobble.
 * Overshoots corners slightly for an Illustrator-pencil register.
 */
export function wobbledPolylinePath(
  points: PctPoint[],
  opts: HandDrawnOpts,
): string {
  if (points.length < 2) return "";
  const rand = seededRandom(opts.seed);
  const amp = opts.amplitude ?? 0.018;
  const sub = Math.max(1, opts.subdivisions ?? 2);
  const endsMatch =
    points.length >= 3 &&
    Math.abs(points[0]!.x - points[points.length - 1]!.x) < 1e-6 &&
    Math.abs(points[0]!.y - points[points.length - 1]!.y) < 1e-6;
  const closed = opts.closed === true || endsMatch;
  const ring = endsMatch ? points.slice(0, -1) : points;
  if (ring.length < 2) return "";

  const out: PctPoint[] = [];
  const n = ring.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    out.push(a);
    for (let s = 1; s <= sub; s++) {
      const t = s / (sub + 1);
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wobble = (rand() * 2 - 1) * amp * len;
      out.push({ x: mx + nx * wobble, y: my + ny * wobble });
    }
  }
  if (!closed) out.push(ring[n - 1]!);

  // Corner overshoot — nudge the last mid-point of each original corner.
  for (let i = 0; i < segs; i++) {
    const idx = i * (sub + 1);
    const p = out[idx];
    if (!p) continue;
    const over = (rand() * 2 - 1) * 0.12;
    out[idx] = { x: p.x + over, y: p.y + over * 0.6 };
  }

  let d = `M ${out[0]!.x.toFixed(3)} ${out[0]!.y.toFixed(3)}`;
  for (let i = 1; i < out.length; i++) {
    const p = out[i]!;
    d += ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
  }
  if (closed) d += " Z";
  return d;
}

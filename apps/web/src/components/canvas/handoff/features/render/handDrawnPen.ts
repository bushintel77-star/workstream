/**
 * Freehand CAD pencil — Rough.js over board-% geometry.
 * Seeded so a given plan redraws identically (honesty).
 */

import { RoughGenerator } from "roughjs/bin/generator";
import { fnv1a32 } from "./seededRandom";
import type { PctPoint } from "../../geometry/types";

export type HandDrawnOpts = {
  /** Seed key — typically projectId + ring role. */
  seed: string;
  /** Rough.js roughness (default 1.05). */
  roughness?: number;
  /** Rough.js bowing (default 0.85). */
  bowing?: number;
  /** Force a closed path (title rings often omit the repeated first vertex). */
  closed?: boolean;
};

const generator = new RoughGenerator();

function seedNum(seed: string): number {
  // Rough seeds are 31-bit positive ints.
  return (fnv1a32(seed) & 0x7fffffff) || 1;
}

function ringPoints(
  points: PctPoint[],
  closed: boolean | undefined,
): Array<[number, number]> {
  if (points.length < 2) return [];
  const endsMatch =
    points.length >= 3 &&
    Math.abs(points[0]!.x - points[points.length - 1]!.x) < 1e-6 &&
    Math.abs(points[0]!.y - points[points.length - 1]!.y) < 1e-6;
  const ring = endsMatch ? points.slice(0, -1) : points;
  const pts: Array<[number, number]> = ring.map((p) => [p.x, p.y]);
  if ((closed === true || endsMatch) && pts.length >= 2) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      pts.push([first[0], first[1]]);
    }
  }
  return pts;
}

/** Join Rough path infos into one SVG `d` (stroke sketch only). */
function drawableToD(
  drawable: ReturnType<RoughGenerator["polygon"]>,
): string {
  const paths = generator.toPaths(drawable);
  return paths
    .map((p) => p.d)
    .filter(Boolean)
    .join(" ");
}

/**
 * Convert a closed or open %-ring into an SVG path with seeded Rough pencil.
 */
export function wobbledPolylinePath(
  points: PctPoint[],
  opts: HandDrawnOpts,
): string {
  const pts = ringPoints(points, opts.closed);
  if (pts.length < 2) return "";
  const endsMatch =
    Math.abs(pts[0]![0] - pts[pts.length - 1]![0]) < 1e-6 &&
    Math.abs(pts[0]![1] - pts[pts.length - 1]![1]) < 1e-6;
  const closed = opts.closed === true || endsMatch;
  const drawable = closed
    ? generator.polygon(pts, {
        seed: seedNum(opts.seed),
        roughness: opts.roughness ?? 1.05,
        bowing: opts.bowing ?? 0.85,
        stroke: "#000",
        fill: "none",
        disableMultiStroke: true,
      })
    : generator.linearPath(pts, {
        seed: seedNum(opts.seed),
        roughness: opts.roughness ?? 1.05,
        bowing: opts.bowing ?? 0.85,
        stroke: "#000",
        disableMultiStroke: true,
      });
  return drawableToD(drawable);
}

/** Seeded Rough ellipse path (e.g. plant canopy discs) in %-space. */
export function roughEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  opts?: { roughness?: number; bowing?: number },
): string {
  if (!(rx > 0) || !(ry > 0)) return "";
  const drawable = generator.ellipse(cx, cy, rx * 2, ry * 2, {
    seed: seedNum(seed),
    roughness: opts?.roughness ?? 1.1,
    bowing: opts?.bowing ?? 0.9,
    stroke: "#000",
    fill: "none",
    disableMultiStroke: true,
  });
  return drawableToD(drawable);
}

/** Seeded Rough circle path. */
export function roughCirclePath(
  cx: number,
  cy: number,
  r: number,
  seed: string,
  opts?: { roughness?: number; bowing?: number },
): string {
  return roughEllipsePath(cx, cy, r, r, seed, opts);
}

/**
 * Freehand CAD pencil — Rough.js over board-% geometry.
 * Seeded so a given plan redraws identically (honesty).
 */

import { RoughGenerator } from "roughjs/bin/generator";
import type { Options } from "roughjs/bin/core";
import { fnv1a32 } from "./seededRandom";
import type { PctPoint } from "../../geometry/types";

/** Role-tuned pencil weight — boundary firmer than canopy. */
export type HandDrawnProfile =
  | "boundary"
  | "building"
  | "region"
  | "canopy"
  | "leader";

export type HandDrawnOpts = {
  /** Seed key — typically projectId + ring role. */
  seed: string;
  /** Rough.js roughness override. */
  roughness?: number;
  /** Rough.js bowing override. */
  bowing?: number;
  /** Force a closed path (title rings often omit the repeated first vertex). */
  closed?: boolean;
  /** Pencil profile — defaults to boundary. */
  profile?: HandDrawnProfile;
};

const generator = new RoughGenerator();

const PROFILE: Record<
  HandDrawnProfile,
  Pick<Options, "roughness" | "bowing" | "maxRandomnessOffset" | "disableMultiStroke">
> = {
  // Title ring — readable, slight graphite wobble.
  boundary: {
    roughness: 0.85,
    bowing: 0.55,
    maxRandomnessOffset: 1.1,
    disableMultiStroke: false,
  },
  // Dwelling — a touch firmer / less bow than the lot ring.
  building: {
    roughness: 0.75,
    bowing: 0.45,
    maxRandomnessOffset: 0.95,
    disableMultiStroke: false,
  },
  // Planting / hardscape regions — softer concept stroke.
  region: {
    roughness: 1.05,
    bowing: 0.7,
    maxRandomnessOffset: 1.25,
    disableMultiStroke: true,
  },
  // Canopy / root discs — sketchiest.
  canopy: {
    roughness: 1.25,
    bowing: 0.95,
    maxRandomnessOffset: 1.4,
    disableMultiStroke: true,
  },
  leader: {
    roughness: 0.9,
    bowing: 0.6,
    maxRandomnessOffset: 1.0,
    disableMultiStroke: true,
  },
};

function seedNum(seed: string): number {
  // Rough seeds are 31-bit positive ints.
  return (fnv1a32(seed) & 0x7fffffff) || 1;
}

function profileOpts(
  profile: HandDrawnProfile,
  overrides?: Pick<HandDrawnOpts, "roughness" | "bowing">,
): Options {
  const base = PROFILE[profile];
  return {
    seed: 0, // filled by caller
    stroke: "#000",
    fill: "none",
    ...base,
    ...(overrides?.roughness != null ? { roughness: overrides.roughness } : null),
    ...(overrides?.bowing != null ? { bowing: overrides.bowing } : null),
  };
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
  const profile = opts.profile ?? (closed ? "boundary" : "leader");
  const roughOpts: Options = {
    ...profileOpts(profile, opts),
    seed: seedNum(opts.seed),
  };
  const drawable = closed
    ? generator.polygon(pts, roughOpts)
    : generator.linearPath(pts, roughOpts);
  return drawableToD(drawable);
}

/** Seeded Rough ellipse path (e.g. plant canopy discs) in %-space. */
export function roughEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  opts?: {
    roughness?: number;
    bowing?: number;
    profile?: HandDrawnProfile;
  },
): string {
  if (!(rx > 0) || !(ry > 0)) return "";
  const profile = opts?.profile ?? "canopy";
  const roughOpts: Options = {
    ...profileOpts(profile, opts),
    seed: seedNum(seed),
  };
  const drawable = generator.ellipse(cx, cy, rx * 2, ry * 2, roughOpts);
  return drawableToD(drawable);
}

/** Seeded Rough circle path. */
export function roughCirclePath(
  cx: number,
  cy: number,
  r: number,
  seed: string,
  opts?: {
    roughness?: number;
    bowing?: number;
    profile?: HandDrawnProfile;
  },
): string {
  return roughEllipsePath(cx, cy, r, r, seed, opts);
}

/** Expose profiles for unit tests / compose previews. */
export function handDrawnProfileDefaults(
  profile: HandDrawnProfile,
): (typeof PROFILE)[HandDrawnProfile] {
  return PROFILE[profile];
}

/**
 * Trench-path math for the WebGL studio's drawable trench tool.
 *
 * Pure + unit-tested; produces `ConstructionTrench` with `source: "traced"`
 * (the operator-drawn provenance the contract already reserves but nothing
 * writes yet). Reuses domain `pointInRing` (conflict) and
 * `polylineLengthFromCanvasPercent` (live length) so the traced tool's
 * numbers agree with auto-trench's own BOM math.
 */
import type {
  ConstructionTrench,
  ConstructionTrenchKind,
} from "@workstream/contracts";
import {
  pointInRing,
  polylineLengthFromCanvasPercent,
  type CanvasGroundScale,
} from "@workstream/domain";

export type TrenchPointPct = { x: number; y: number };

/** Minimum pointer travel (board %) before a trench vertex is appended. */
export const MIN_TRENCH_POINT_DISTANCE_PCT = 0.5;

/** Indicative depth (mm) per trench kind — mirrors auto-trench DEPTH. */
export const TRENCH_DEPTH_MM: Record<ConstructionTrenchKind, number> = {
  irrig_main: 400,
  irrig_lateral: 250,
  lighting_conduit: 300,
  drainage: 450,
};

/** Append a vertex only when the pointer has travelled far enough. */
export function shouldAppendTrenchPoint(
  prev: TrenchPointPct,
  next: TrenchPointPct,
  minPct = MIN_TRENCH_POINT_DISTANCE_PCT,
): boolean {
  return Math.hypot(next.x - prev.x, next.y - prev.y) >= minPct;
}

/**
 * True if any vertex falls inside a closed no-dig ring (easement / TPZ /
 * utility corridor). Vertex check is the v1 heuristic — the operator draws
 * by hand, so we flag rather than auto-nudge.
 */
export function trenchConflictsWithRings(
  points: TrenchPointPct[],
  rings: TrenchPointPct[][],
): boolean {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const lngLat = ring.map((p) => [p.x, p.y] as [number, number]);
    for (const p of points) {
      if (pointInRing(p.x, p.y, lngLat)) return true;
    }
  }
  return false;
}

/** Polyline length in metres. */
export function trenchLengthM(
  points: TrenchPointPct[],
  scale: CanvasGroundScale,
): number {
  return polylineLengthFromCanvasPercent(
    points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    scale,
  );
}

/** Build a committed (non-ghost) operator-drawn trench. */
export function buildTracedTrench(args: {
  id: string;
  name: string;
  kind: ConstructionTrenchKind;
  points: TrenchPointPct[];
  depthMm?: number;
  why?: string;
}): ConstructionTrench {
  return {
    id: args.id,
    name: args.name,
    kind: args.kind,
    points: args.points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    depth_mm: args.depthMm ?? TRENCH_DEPTH_MM[args.kind],
    source: "traced",
    why: args.why,
  };
}

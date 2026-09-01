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

/**
 * True if any vertex falls OUTSIDE the closed title-boundary ring. The title
 * boundary is the platform's single source of truth for site geometry — a
 * construction run leaving the lot is a hard dig-safety error, so the draft
 * strikes it live (flag, not auto-nudge — the same philosophy as no-dig
 * rings). The committed run is snapped so it can never persist off-lot.
 */
export function trenchLeavesBoundary(
  points: TrenchPointPct[],
  boundary: TrenchPointPct[],
): boolean {
  if (boundary.length < 3) return false;
  const ring = boundary.map((p) => [p.x, p.y] as [number, number]);
  for (const p of points) {
    if (!pointInRing(p.x, p.y, ring)) return true;
  }
  return false;
}

/** Nearest point on the closed ring to `p` (projection onto the closest edge). */
function nearestOnRing(p: TrenchPointPct, ring: TrenchPointPct[]): TrenchPointPct {
  let best = ring[0] ?? { x: p.x, y: p.y };
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/**
 * Snap any vertex that falls outside the title boundary onto the nearest
 * boundary edge, leaving in-boundary vertices untouched. The commit-path
 * reconciliation for the title-boundary rule: a traced construction run can
 * never persist beyond the title line. With no boundary (`boundary.length < 3`)
 * there is no site frame to reconcile against, so the path is returned
 * unchanged — the trace stands as drawn (locational-indicative by the absence
 * of site truth).
 */
export function snapPolylineToBoundary(
  points: TrenchPointPct[],
  boundary: TrenchPointPct[],
): TrenchPointPct[] {
  if (boundary.length < 3) return points;
  const ring = boundary.map((p) => [p.x, p.y] as [number, number]);
  return points.map((p) =>
    pointInRing(p.x, p.y, ring) ? p : nearestOnRing(p, boundary),
  );
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

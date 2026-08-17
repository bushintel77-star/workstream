/**
 * Irrigation-zone path math for the WebGL studio's drawable zone tool.
 *
 * Pure + unit-tested; produces a closed-polygon `IrrigationZone` from a
 * hand-drawn trace. Reuses domain `emitterCountForLine` + `zoneFlowLph` so
 * the live flow readout agrees with the fit-sheet BOM math.
 */
import type {
  IrrigationZone,
  IrrigationZoneKind,
} from "@workstream/contracts";
import { emitterCountForLine, zoneFlowLph } from "@workstream/domain";
import { pctToWorld } from "./coordTransform";

export type ZonePointPct = { x: number; y: number };

/** Minimum pointer travel (board %) before a zone vertex is appended. */
export const MIN_ZONE_POINT_DISTANCE_PCT = 0.5;

/** Close tolerance (board %) for treating the polygon as already closed. */
const ZONE_CLOSE_TOLERANCE_PCT = 0.05;

/** Append a vertex only when the pointer has travelled far enough. */
export function shouldAppendZonePoint(
  prev: ZonePointPct,
  next: ZonePointPct,
  minPct = MIN_ZONE_POINT_DISTANCE_PCT,
): boolean {
  return Math.hypot(next.x - prev.x, next.y - prev.y) >= minPct;
}

/** Close a polygon by appending the first vertex when the ring is open. */
export function closeZonePolygon(points: ZonePointPct[]): ZonePointPct[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < ZONE_CLOSE_TOLERANCE_PCT;
  return closed ? points : [...points, { x: first.x, y: first.y }];
}

/** World-space perimeter length in metres (aspect-correct). */
export function zonePerimeterM(
  points: ZonePointPct[],
  scaleM: number,
  boardAspect: number,
): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = pctToWorld(points[i - 1]!, scaleM, boardAspect);
    const [bx, bz] = pctToWorld(points[i]!, scaleM, boardAspect);
    len += Math.hypot(bx - ax, bz - az);
  }
  return len;
}

/** Polygon area in m² (shoelace on world coords, closes first). */
export function zoneAreaM2(
  points: ZonePointPct[],
  scaleM: number,
  boardAspect: number,
): number {
  if (points.length < 3) return 0;
  const closed = closeZonePolygon(points);
  let twice = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, az] = pctToWorld(closed[i]!, scaleM, boardAspect);
    const [bx, bz] = pctToWorld(closed[i + 1]!, scaleM, boardAspect);
    twice += ax * bz - bx * az;
  }
  return Math.abs(twice) / 2;
}

/**
 * Estimated zone flow (L/h) — emitters along the closed perimeter at the
 * zone's spacing, times per-emitter flow. Indicative first pass, matching
 * the domain's own summarise math.
 */
export function estimateZoneFlowLph(
  points: ZonePointPct[],
  spacingCm: number,
  flowLphPerEmitter: number,
  scaleM: number,
  boardAspect: number,
): number {
  const perimeterM = zonePerimeterM(closeZonePolygon(points), scaleM, boardAspect);
  const emitters = emitterCountForLine(perimeterM, spacingCm);
  return zoneFlowLph(emitters, flowLphPerEmitter);
}

/** Build a committed traced zone (closed ring, defaults when unspecified). */
export function buildTracedZone(args: {
  id: string;
  name: string;
  kind: IrrigationZoneKind;
  points: ZonePointPct[];
  emitterSpacingCm?: number;
  emitterFlowLph?: number;
}): IrrigationZone {
  return {
    id: args.id,
    name: args.name,
    kind: args.kind,
    points: closeZonePolygon(args.points).map((p) => ({
      x_pct: p.x,
      y_pct: p.y,
    })),
    emitter_spacing_cm: args.emitterSpacingCm ?? 30,
    emitter_flow_lph: args.emitterFlowLph ?? 2,
  };
}

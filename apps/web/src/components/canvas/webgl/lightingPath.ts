/**
 * Lighting-run path math for the WebGL studio's drawable lighting tool.
 *
 * Pure + unit-tested; produces an OPEN-path `IrrigationZone` of kind
 * "lighting" — the contract's "fixture run along path" kind. Unlike the
 * irrigation-zone tool (closed rings with area + flow), a lighting run is a
 * polyline: the live readout is run length (m) + fixture count. Length uses
 * the same world-space (aspect-correct) convention as trenchPath /
 * irrigationZonePath so all three tools agree on metres.
 *
 * Fixture count = floor(length / spacing) + 1 — both ends of the run are lit.
 * The committed zone carries `fixture_spacing_m` + `wire_gauge` ("12/2", the
 * session default) for the domain LV circuit model (`lv-lighting`).
 */
import type { IrrigationZone } from "@workstream/contracts";
import { pctToWorld } from "./coordTransform";

export type LightingPointPct = { x: number; y: number };

/** Minimum pointer travel (board %) before a run vertex is appended. */
export const MIN_LIGHTING_POINT_DISTANCE_PCT = 0.5;

/** Default fixture spacing along a run (m) — matches the contract default. */
export const DEFAULT_LIGHTING_FIXTURE_SPACING_M = 2.5;

/** Append a vertex only when the pointer has travelled far enough. */
export function shouldAppendLightingPoint(
  prev: LightingPointPct,
  next: LightingPointPct,
  minPct = MIN_LIGHTING_POINT_DISTANCE_PCT,
): boolean {
  return Math.hypot(next.x - prev.x, next.y - prev.y) >= minPct;
}

/** Open polyline length in metres (aspect-correct world space). */
export function lightingRunLengthM(
  points: LightingPointPct[],
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

/** Fixture count along an open run — both ends lit. */
export function fixtureCountForRun(lengthM: number, spacingM: number): number {
  if (!(lengthM > 0) || !(spacingM > 0)) return 0;
  return Math.floor(lengthM / spacingM) + 1;
}

/**
 * World-space [x, z] fixture positions every `spacingM` along the run,
 * starting at the first vertex and ending at the run end (inclusive).
 */
export function fixturePositionsWorld(
  points: LightingPointPct[],
  spacingM: number,
  scaleM: number,
  boardAspect: number,
): Array<[number, number]> {
  if (points.length < 2 || !(spacingM > 0)) return [];
  const world = points.map((p) => pctToWorld(p, scaleM, boardAspect));
  const out: Array<[number, number]> = [[world[0]![0], world[0]![1]]];
  let next = spacingM;
  let acc = 0;
  for (let i = 1; i < world.length; i++) {
    const a = world[i - 1]!;
    const b = world[i]!;
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= acc + segLen + 1e-9) {
      const t = segLen > 0 ? (next - acc) / segLen : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const last = out[out.length - 1]!;
      if (Math.hypot(x - last[0], y - last[1]) > 1e-6) {
        out.push([x, y]);
      }
      next += spacingM;
    }
    acc += segLen;
  }
  return out;
}

/** Build a committed traced lighting run (open path, contract defaults). */
export function buildTracedLightingRun(args: {
  id: string;
  name: string;
  points: LightingPointPct[];
  fixtureSpacingM?: number;
}): IrrigationZone {
  return {
    id: args.id,
    name: args.name,
    kind: "lighting",
    points: args.points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    // Schema defaults carried on every zone kind; the irrigation math
    // ignores these two on lighting runs (no water on the ground).
    emitter_spacing_cm: 30,
    emitter_flow_lph: 2,
    fixture_spacing_m:
      args.fixtureSpacingM ?? DEFAULT_LIGHTING_FIXTURE_SPACING_M,
    wire_gauge: "12/2",
  };
}

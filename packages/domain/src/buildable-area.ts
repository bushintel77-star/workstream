/**
 * Buildable Area - the site minus every exclusion, with per-zone attribution.
 *
 * Combines constraints that are each displayed separately today into one
 * computed polygon: boundary - setback - building - easements - BYDA assets
 * - TPZ rings - flood/heritage/bushfire/planning overlays.
 *
 * Works in planar metres (board % -> m via board_width_m) using Turf boolean
 * difference, the same approach as outdoor-area.ts. Returns the remnant
 * polygon in board % coords plus a per-exclusion m2 breakdown.
 *
 * Domain-pure: no server / DOM imports.
 */

import { difference, featureCollection } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

type PlanarRing = [number, number][];

export type BoardPctPoint = { x_pct: number; y_pct: number };

export type BuildableExclusionKind =
  | 'setback'
  | 'building'
  | 'easement'
  | 'byda'
  | 'tpz'
  | 'flood'
  | 'heritage'
  | 'bushfire'
  | 'planning';

export type BuildableExclusion = {
  kind: BuildableExclusionKind;
  label: string;
  area_m2: number;
};

export type BuildableAreaResult = {
  buildable_m2: number;
  lot_m2: number;
  exclusions: BuildableExclusion[];
  polygons: BoardPctPoint[][];
};

export type TpzCircleInput = {
  id: string;
  x_pct: number;
  y_pct: number;
  radius_m: number;
  label?: string;
};

export type OverlayInput = {
  kind: 'flood' | 'heritage' | 'bushfire' | 'planning';
  rings: BoardPctPoint[][];
  label?: string;
};

export type BuildableAreaInput = {
  boundary: BoardPctPoint[];
  building?: BoardPctPoint[];
  easements?: BoardPctPoint[][];
  byda_assets?: Array<{ kind: string; ring: BoardPctPoint[] }>;
  tpz_circles?: TpzCircleInput[];
  overlays?: OverlayInput[];
  setback_m?: number;
  board_width_m: number;
};

function openRing(ring: PlanarRing): PlanarRing {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function closeRing(ring: PlanarRing): PlanarRing {
  const open = openRing(ring);
  if (open.length < 3) return open;
  return [...open, open[0]!];
}

function ringToPolygon(ring: PlanarRing): Feature<Polygon> | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return null;
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [closed] },
    properties: {},
  };
}

function shoelaceArea(ring: PlanarRing): number {
  const pts = openRing(ring);
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function polygonAreaWithHoles(coords: Position[][]): number {
  const outer = coords[0];
  if (!outer || outer.length < 3) return 0;
  let area = shoelaceArea(
    outer.map((c) => [c[0]!, c[1]!] as [number, number]),
  );
  for (let i = 1; i < coords.length; i++) {
    const hole = coords[i];
    if (hole && hole.length >= 3) {
      area -= shoelaceArea(
        hole.map((c) => [c[0]!, c[1]!] as [number, number]),
      );
    }
  }
  return Math.max(0, area);
}

function pctToMeters(p: BoardPctPoint, boardWidthM: number): [number, number] {
  return [(p.x_pct / 100) * boardWidthM, (p.y_pct / 100) * boardWidthM];
}

function metersToPct(x: number, y: number, boardWidthM: number): BoardPctPoint {
  return {
    x_pct: (x / boardWidthM) * 100,
    y_pct: (y / boardWidthM) * 100,
  };
}

function pctRingToMeters(ring: BoardPctPoint[], boardWidthM: number): PlanarRing {
  return ring.map((p) => pctToMeters(p, boardWidthM));
}

function positionsToPctRing(
  coords: Position[],
  boardWidthM: number,
): BoardPctPoint[] {
  return openRing(
    coords.map((c) => [c[0]!, c[1]!] as [number, number]),
  ).map(([x, y]) => metersToPct(x, y, boardWidthM));
}

function circleToPlanarRing(
  centerM: [number, number],
  radiusM: number,
  segments = 32,
): PlanarRing {
  const ring: PlanarRing = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([
      centerM[0] + Math.cos(a) * radiusM,
      centerM[1] + Math.sin(a) * radiusM,
    ]);
  }
  return ring;
}

function inwardSetbackPlanar(
  boundaryM: PlanarRing,
  setbackM: number,
): PlanarRing | null {
  if (setbackM <= 0) return null;
  const closed = closeRing(boundaryM);
  if (closed.length < 4) return null;
  const open = openRing(boundaryM);
  if (open.length < 3) return null;
  const n = open.length;
  const offsetPts: [number, number][] = [];
  let rawArea = 0;
  for (let j = 0; j < n; j++) {
    const p = open[j]!;
    const q = open[(j + 1) % n]!;
    rawArea += p[0] * q[1] - q[0] * p[1];
  }
  const cw = rawArea > 0;
  for (let i = 0; i < n; i++) {
    const prev = open[(i - 1 + n) % n]!;
    const curr = open[i]!;
    const next = open[(i + 1) % n]!;
    const v1x = curr[0] - prev[0];
    const v1y = curr[1] - prev[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];
    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const n1x = cw ? -v1y / len1 : v1y / len1;
    const n1y = cw ? v1x / len1 : -v1x / len1;
    const n2x = cw ? -v2y / len2 : v2y / len2;
    const n2y = cw ? v2x / len2 : -v2x / len2;
    const e1a: [number, number] = [prev[0] + n1x * setbackM, prev[1] + n1y * setbackM];
    const e1b: [number, number] = [curr[0] + n1x * setbackM, curr[1] + n1y * setbackM];
    const e2a: [number, number] = [curr[0] + n2x * setbackM, curr[1] + n2y * setbackM];
    const e2b: [number, number] = [next[0] + n2x * setbackM, next[1] + n2y * setbackM];
    const pt = lineIntersection(e1a, e1b, e2a, e2b);
    if (pt) {
      offsetPts.push(pt);
    } else {
      const bx = (n1x + n2x) / 2;
      const by = (n1y + n2y) / 2;
      const blen = Math.hypot(bx, by) || 1;
      offsetPts.push([
        curr[0] + (bx / blen) * setbackM,
        curr[1] + (by / blen) * setbackM,
      ]);
    }
  }
  if (offsetPts.length < 3) return null;
  const offsetArea = shoelaceArea(offsetPts);
  if (offsetArea <= 0) return null;
  return offsetPts;
}

function lineIntersection(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): [number, number] | null {
  const d1x = a2[0] - a1[0];
  const d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0];
  const d2y = b2[1] - b1[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom;
  return [a1[0] + t * d1x, a1[1] + t * d1y];
}

function turfArea(result: Feature<Polygon | MultiPolygon> | null): number {
  if (!result) return 0;
  const geom = result.geometry;
  if (geom.type === "Polygon") {
    return polygonAreaWithHoles(geom.coordinates);
  }
  let total = 0;
  for (const poly of geom.coordinates) {
    total += polygonAreaWithHoles(poly);
  }
  return total;
}

function turfToPctRings(
  result: Feature<Polygon | MultiPolygon> | null,
  boardWidthM: number,
): BoardPctPoint[][] {
  if (!result) return [];
  const geom = result.geometry;
  const rings: BoardPctPoint[][] = [];
  if (geom.type === "Polygon") {
    const outer = geom.coordinates[0];
    if (outer && outer.length >= 3) {
      rings.push(positionsToPctRing(outer, boardWidthM));
    }
  } else {
    for (const poly of geom.coordinates) {
      const outer = poly[0];
      if (outer && outer.length >= 3) {
        rings.push(positionsToPctRing(outer, boardWidthM));
      }
    }
  }
  return rings;
}

export function computeBuildableArea(input: BuildableAreaInput): BuildableAreaResult {
  const boardWidthM = input.board_width_m;
  if (!(boardWidthM > 0) || input.boundary.length < 3) {
    return { buildable_m2: 0, lot_m2: 0, exclusions: [], polygons: [] };
  }
  const boundaryM = pctRingToMeters(input.boundary, boardWidthM);
  const lotArea = shoelaceArea(boundaryM);
  const exclusions: BuildableExclusion[] = [];
  let current: Feature<Polygon | MultiPolygon> | null = ringToPolygon(boundaryM);
  if (!current) {
    return { buildable_m2: 0, lot_m2: lotArea, exclusions, polygons: [] };
  }
  const setbackM = input.setback_m ?? 1.5;
  if (setbackM > 0) {
    const inset = inwardSetbackPlanar(boundaryM, setbackM);
    if (inset) {
      const insetPoly = ringToPolygon(inset);
      if (insetPoly) {
        const beforeArea = turfArea(current);
        current = insetPoly;
        const afterArea = turfArea(current);
        const lost = Math.max(0, beforeArea - afterArea);
        if (lost > 0.01) {
          exclusions.push({
            kind: 'setback',
            label: `${setbackM.toFixed(1)} m council setback`,
            area_m2: Math.round(lost * 10) / 10,
          });
        }
      }
    }
  }
  function subtract(
    ringM: PlanarRing,
    kind: BuildableExclusionKind,
    label: string,
  ): void {
    if (!current) return;
    const sub = ringToPolygon(ringM);
    if (!sub) return;
    const beforeArea = turfArea(current);
    const next = difference(featureCollection([current, sub]));
    const afterArea = turfArea(next);
    const lost = Math.max(0, beforeArea - afterArea);
    if (lost > 0.01) {
      exclusions.push({ kind, label, area_m2: Math.round(lost * 10) / 10 });
    }
    current = next;
  }
  if (input.building && input.building.length >= 3) {
    subtract(pctRingToMeters(input.building, boardWidthM), "building", "Dwelling footprint");
  }
  for (let i = 0; i < (input.easements?.length ?? 0); i++) {
    const ring = input.easements![i]!;
    if (ring.length < 3) continue;
    subtract(pctRingToMeters(ring, boardWidthM), "easement", `Easement ${i + 1}`);
  }
  for (const asset of input.byda_assets ?? []) {
    if (asset.ring.length < 3) continue;
    subtract(pctRingToMeters(asset.ring, boardWidthM), "byda", labelForBydaKind(asset.kind));
  }
  for (const tpz of input.tpz_circles ?? []) {
    if (tpz.radius_m <= 0) continue;
    const centerM = pctToMeters({ x_pct: tpz.x_pct, y_pct: tpz.y_pct }, boardWidthM);
    subtract(circleToPlanarRing(centerM, tpz.radius_m), "tpz", tpz.label ?? "TPZ - existing tree");
  }
  for (const overlay of input.overlays ?? []) {
    for (const ring of overlay.rings) {
      if (ring.length < 3) continue;
      subtract(pctRingToMeters(ring, boardWidthM), overlay.kind, labelForOverlay(overlay.kind, overlay.label));
    }
  }
  const buildableM2 = turfArea(current);
  const polygons = turfToPctRings(current, boardWidthM);
  return {
    buildable_m2: Math.round(buildableM2 * 10) / 10,
    lot_m2: Math.round(lotArea * 10) / 10,
    exclusions,
    polygons: polygons.length ? polygons : [input.boundary],
  };
}

function labelForBydaKind(kind: string): string {
  const labels: Record<string, string> = {
    sewer: "Sewer BYDA asset",
    stormwater: "Stormwater BYDA asset",
    water: "Water main BYDA asset",
    gas: "Gas BYDA asset",
    power: "Power BYDA asset",
    nbn: "NBN BYDA asset",
    other: "Utility BYDA asset",
  };
  return labels[kind] ?? `${kind} BYDA asset`;
}

function labelForOverlay(kind: BuildableExclusionKind, label?: string): string {
  if (label) return label;
  const labels: Record<string, string> = {
    flood: "Flood overlay",
    heritage: "Heritage overlay",
    bushfire: "Bushfire (BMO) overlay",
    planning: "Planning overlay",
  };
  return labels[kind] ?? `${kind} overlay`;
}

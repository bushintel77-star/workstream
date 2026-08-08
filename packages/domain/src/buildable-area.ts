/**
 * Buildable Area — the site minus every exclusion, with per-zone attribution.
 *
 * Combines constraints that are each displayed separately today into one
 * computed polygon: boundary - setback - building - easements - BYDA assets
 * - TPZ rings - flood/heritage/bushfire/planning overlays.
 *
 * Works in planar metres (board % -> m via board_width_m) using Turf boolean
 * difference, the same approach as `outdoor-area.ts`. Returns the remnant
 * polygon in board % coords plus a per-exclusion m2 breakdown so the operator
 * can see "you lost 34 m2 to the sewer easement, 12 m2 to TPZ".
 *
 * Domain-pure: no server / DOM imports.
 */

import { difference, featureCollection } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

/** Planar ring in metres — open or closed. */
type PlanarRing = [number, number][];

/** Board % point (domain — distinct from web's {x, y} PctPoint). */
export type BoardPctPoint = { x_pct: number; y_pct: number };

export type BuildableExclusionKind =
  | "setback"
  | "building"
  | "easement"
  | "byda"
  | "tpz"
  | "flood"
  | "heritage"
  | "bushfire"
  | "planning";

export type BuildableExclusion = {
  kind: BuildableExclusionKind;
  /** Human-readable label, e.g. "Sewer BYDA asset", "TPZ - existing oak". */
  label: string;
  /** Area removed by this exclusion (m2). */
  area_m2: number;
};

export type BuildableAreaResult = {
  /** Remaining buildable area (m2). */
  buildable_m2: number;
  /** Lot area (m2). */
  lot_m2: number;
  /** Per-exclusion breakdown, in processing order. */
  exclusions: BuildableExclusion[];
  /** Buildable polygon outer rings in board % coords. */
  polygons: BoardPctPoint[][];
};

export type TpzCircleInput = {
  id: string;
  x_pct: number;
  y_pct: number;
  /** TPZ radius in metres (AS 4970: 12 x DBH, min 2 m). */
  radius_m: number;
  label?: string;
};

export type OverlayInput = {
  kind: "flood" | "heritage" | "bushfire" | "planning";
  /** Rings in board % coords. */
  rings: BoardPctPoint[][];
  label?: string;
};

export type BuildableAreaInput = {
  /** Title boundary in board % coords. */
  boundary: BoardPctPoint[];
  /** Dwelling footprint in board % coords. */
  building?: BoardPctPoint[];
  /** Easement rings in board % coords. */
  easements?: BoardPctPoint[][];
  /** BYDA asset rings with kind labels. */
  byda_assets?: Array<{
    kind: string;
    ring: BoardPctPoint[];
  }>;
  /** TPZ circles (already computed from DBH). */
  tpz_circles?: TpzCircleInput[];
  /** Keyless overlays that exclude building (flood/heritage/bushfire/planning). */
  overlays?: OverlayInput[];
  /** Council setback in metres (default 1.5). */
  setback_m?: number;
  /** Board width in metres — 100% board width = this many metres. */
  board_width_m: number;
};

// --- ring helpers ---

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
  // Build GeoJSON Feature manually — Turf's polygon() can rewrite coords.
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

// --- coordinate conversion ---

function pctToMeters(p: BoardPctPoint, boardWidthM: number): [number, number] {
  // Board is square (100x100 viewBox); X and Y both scale by board_width_m.
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

// --- TPZ circle to polygon ---

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

// --- setback ring (inward buffer) ---

function inwardSetbackPlanar(
  boundaryM: PlanarRing,
  setbackM: number,
): PlanarRing | null {
  if (setbackM <= 0) return null;
  const closed = closeRing(boundaryM);
  if (closed.length < 4) return null;

  // Inward offset by moving each edge inward by setbackM.
  // Simple polygon offset — works for convex and mildly concave lots.
  // For complex concave lots this is indicative (Turf buffer is the robust
  // path, but it needs lng/lat; in planar metres we do edge offset).
  const open = openRing(boundaryM);
  if (open.length < 3) return null;

  const n = open.length;
  const offsetPts: [number, number][] = [];

  // Compute signed area to determine winding order.
  // Board % coords are Y-down (0 = top, 100 = bottom), so a positive signed
  // area means the polygon is clockwise in screen space. The inward normal
  // direction depends on winding.
  let rawArea = 0;
  for (let j = 0; j < n; j++) {
    const p = open[j]!;
    const q = open[(j + 1) % n]!;
    rawArea += p[0] * q[1] - q[0] * p[1];
  }
  // In Y-down: positive rawArea = CW screen winding -> inward = rotate +90 deg.
  // In Y-down: negative rawArea = CCW screen winding -> inward = rotate -90 deg.
  const cw = rawArea > 0;

  for (let i = 0; i < n; i++) {
    const prev = open[(i - 1 + n) % n]!;
    const curr = open[i]!;
    const next = open[(i + 1) % n]!;

    // Edge vectors
    const v1x = curr[0] - prev[0];
    const v1y = curr[1] - prev[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];

    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;

    // Inward normal for each edge (Y-down coordinates).
    // CW (rawArea > 0): inward = rotate edge by +90 deg -> (-vy, vx)
    // CCW (rawArea < 0): inward = rotate edge by -90 deg -> (vy, -vx)
    const n1x = cw ? -v1y / len1 : v1y / len1;
    const n1y = cw ? v1x / len1 : -v1x / len1;
    const n2x = cw ? -v2y / len2 : v2y / len2;
    const n2y = cw ? v2x / len2 : -v2x / len2;

    // Offset edges
    const e1a: [number, number] = [prev[0] + n1x * setbackM, prev[1] + n1y * setbackM];
    const e1b: [number, number] = [curr[0] + n1x * setbackM, curr[1] + n1y * setbackM];
    const e2a: [number, number] = [curr[0] + n2x * setbackM, curr[1] + n2y * setbackM];
    const e2b: [number, number] = [next[0] + n2x * setbackM, next[1] + n2y * setbackM];

    // Intersection of the two offset edges = new vertex
    const pt = lineIntersection(e1a, e1b, e2a, e2b);
    if (pt) {
      offsetPts.push(pt);
    } else {
      // Parallel edges — just offset the vertex along the bisector
      const bx = (n1x + n2x) / 2;
      const by = (n1y + n2y) / 2;
      const blen = Math.hypot(bx, by) || 1;
      offsetPts.push([
        curr[0] + (bx / blen) * setbackM,
        curr[1] + (by / blen) * setbackM,
      ]);
    }
  }

  // Validate that the offset ring hasn't collapsed or inverted
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

// --- area of a Turf result ---

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

// --- main computation ---

/**
 * Compute the buildable area polygon and per-exclusion attribution.
 *
 * Processing order: setback -> building -> easements -> BYDA -> TPZ -> overlays
 * (flood, heritage, bushfire, planning). Overlapping exclusions attribute
 * to the first processed — setback is first because it's the largest and
 * most uniform; overlays last because they're often partial.
 */
export function computeBuildableArea(input: BuildableAreaInput): BuildableAreaResult {
  const boardWidthM = input.board_width_m;
  if (!(boardWidthM > 0) || input.boundary.length < 3) {
    return { buildable_m2: 0, lot_m2: 0, exclusions: [], polygons: [] };
  }

  const boundaryM = pctRingToMeters(input.boundary, boardWidthM);
  const lotArea = shoelaceArea(boundaryM);
  const exclusions: BuildableExclusion[] = [];

  // Start with the boundary (or setback-inset boundary).
  let current: Feature<Polygon | MultiPolygon> | null = ringToPolygon(boundaryM);
  if (!current) {
    return { buildable_m2: 0, lot_m2: lotArea, exclusions, polygons: [] };
  }

  // 1. Setback — inset the boundary, use the inset as the starting polygon.
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
            kind: "setback",
            label: `${setbackM.toFixed(1)} m council setback`,
            area_m2: Math.round(lost * 10) / 10,
          });
        }
      }
    }
  }

  // Helper: subtract a ring and record attribution.
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
      exclusions.push({
        kind,
        label,
        area_m2: Math.round(lost * 10) / 10,
      });
    }
    current = next;
  }

  // 2. Building
  if (input.building && input.building.length >= 3) {
    subtract(
      pctRingToMeters(input.building, boardWidthM),
      "building",
      "Dwelling footprint",
    );
  }

  // 3. Easements
  for (let i = 0; i < (input.easements?.length ?? 0); i++) {
    const ring = input.easements![i]!;
    if (ring.length < 3) continue;
    subtract(
      pctRingToMeters(ring, boardWidthM),
      "easement",
      `Easement ${i + 1}`,
    );
  }

  // 4. BYDA assets
  for (const asset of input.byda_assets ?? []) {
    if (asset.ring.length < 3) continue;
    subtract(
      pctRingToMeters(asset.ring, boardWidthM),
      "byda",
      labelForBydaKind(asset.kind),
    );
  }

  // 5. TPZ circles
  for (const tpz of input.tpz_circles ?? []) {
    if (tpz.radius_m <= 0) continue;
    const centerM = pctToMeters(
      { x_pct: tpz.x_pct, y_pct: tpz.y_pct },
      boardWidthM,
    );
    subtract(
      circleToPlanarRing(centerM, tpz.radius_m),
      "tpz",
      tpz.label ?? "TPZ - existing tree",
    );
  }

  // 6. Overlays (flood, heritage, bushfire, planning)
  for (const overlay of input.overlays ?? []) {
    for (const ring of overlay.rings) {
      if (ring.length < 3) continue;
      subtract(
        pctRingToMeters(ring, boardWidthM),
        overlay.kind,
        labelForOverlay(overlay.kind, overlay.label),
      );
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

function labelForOverlay(
  kind: BuildableExclusionKind,
  label?: string,
): string {
  if (label) return label;
  const labels: Record<string, string> = {
    flood: "Flood overlay",
    heritage: "Heritage overlay",
    bushfire: "Bushfire (BMO) overlay",
    planning: "Planning overlay",
  };
  return labels[kind] ?? `${kind} overlay`;
}

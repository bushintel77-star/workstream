import {
  difference,
  featureCollection,
  polygon,
} from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

/** Planar ring in metres (or any Cartesian XY) — open or closed. */
export type PlanarRing = [number, number][];

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
  const first = open[0]!;
  return [...open, first];
}

function ringToPolygon(ring: PlanarRing): Feature<Polygon> | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return null;
  return polygon([closed]);
}

/** Shoelace area of a simple planar ring (open or closed). */
export function planarPolyArea(ring: PlanarRing): number {
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

function positionsToRing(coords: Position[]): PlanarRing {
  return openRing(coords.map((c) => [c[0]!, c[1]!]));
}

/** Outer area minus hole areas for one Polygon coordinate set. */
function polygonAreaWithHoles(coords: Position[][]): number {
  const outer = coords[0];
  if (!outer || outer.length < 3) return 0;
  let area = planarPolyArea(positionsToRing(outer));
  for (let i = 1; i < coords.length; i++) {
    const hole = coords[i];
    if (hole && hole.length >= 3) {
      area -= planarPolyArea(positionsToRing(hole));
    }
  }
  return Math.max(0, area);
}

export type OutdoorDifferenceResult = {
  /** Boolean difference area (title − buildings). */
  areaM2: number;
  /** Naive lot − Σ building areas (breaks on overhang / non-containment). */
  naiveAreaM2: number;
  /** True when |boolean − naive| exceeds the threshold. */
  differsFromNaive: boolean;
  /** Remnant outdoor outer rings (holes stripped — for drawing helpers). */
  polygons: PlanarRing[];
};

const DEFAULT_DIFF_THRESHOLD_M2 = 0.5;

/**
 * True outdoor / workable area = boundary MINUS every subtractor ring via Turf
 * polygon boolean difference (handles overhang, partial overlap, L-shapes).
 * Port of the prototype's outdoorDifferenceM2 behaviour — uses turf.difference,
 * not polygon-clipping.
 *
 * Contained subtractors become holes in the result Polygon; area accounts for
 * those holes (outer − Σ holes). Overhanging polygons only subtract the
 * intersecting portion — which is where boolean ≠ naive.
 *
 * `subtractPolysM` is typically buildings, plus optional easements / existing
 * hardscapes for the Phase-1 "Canvas Canvas" workable remnant.
 */
export function outdoorDifferenceM2(
  boundaryM: PlanarRing,
  subtractPolysM: PlanarRing[],
  opts?: { differThresholdM2?: number },
): OutdoorDifferenceResult {
  const threshold = opts?.differThresholdM2 ?? DEFAULT_DIFF_THRESHOLD_M2;
  const lotArea = planarPolyArea(boundaryM);
  const subtractArea = subtractPolysM.reduce(
    (s, r) => s + planarPolyArea(r),
    0,
  );
  const naiveAreaM2 = Math.max(0, lotArea - subtractArea);

  const parcel = ringToPolygon(boundaryM);
  if (!parcel) {
    return {
      areaM2: 0,
      naiveAreaM2,
      differsFromNaive: Math.abs(0 - naiveAreaM2) > threshold,
      polygons: [],
    };
  }

  const subtractors = subtractPolysM
    .map(ringToPolygon)
    .filter((f): f is Feature<Polygon> => f != null);

  if (subtractors.length === 0) {
    return {
      areaM2: lotArea,
      naiveAreaM2: lotArea,
      differsFromNaive: false,
      polygons: [openRing(boundaryM)],
    };
  }

  let result: Feature<Polygon | MultiPolygon> | null = parcel;
  for (const b of subtractors) {
    if (!result) break;
    result = difference(featureCollection([result, b]));
  }

  const polygons: PlanarRing[] = [];
  let areaM2 = 0;

  if (result) {
    const geom = result.geometry;
    if (geom.type === "Polygon") {
      areaM2 += polygonAreaWithHoles(geom.coordinates);
      const outer = geom.coordinates[0];
      if (outer && outer.length >= 3) polygons.push(positionsToRing(outer));
    } else {
      for (const poly of geom.coordinates) {
        areaM2 += polygonAreaWithHoles(poly);
        const outer = poly[0];
        if (outer && outer.length >= 3) {
          polygons.push(positionsToRing(outer));
        }
      }
    }
  }

  return {
    areaM2,
    naiveAreaM2,
    differsFromNaive: Math.abs(areaM2 - naiveAreaM2) > threshold,
    polygons,
  };
}

/**
 * Workable "Canvas Canvas" in local metres (origin = site corner / board 0,0).
 * Lot − buildings − easements / existing hardscapes / other exclude rings.
 */
export function workableCanvasM2(
  boundaryM: PlanarRing,
  args: {
    buildings?: PlanarRing[];
    exclude?: PlanarRing[];
    differThresholdM2?: number;
  } = {},
): OutdoorDifferenceResult {
  return outdoorDifferenceM2(
    boundaryM,
    [...(args.buildings ?? []), ...(args.exclude ?? [])],
    { differThresholdM2: args.differThresholdM2 },
  );
}

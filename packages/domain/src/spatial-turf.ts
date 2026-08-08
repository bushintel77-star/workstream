import {
  buffer,
  difference,
  featureCollection,
  mask,
  polygon,
} from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

/** WGS84 ring: [lng, lat][], open or closed. */
export type LngLatRing = [number, number][];

function openRing(ring: LngLatRing): LngLatRing {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function closeRing(ring: LngLatRing): LngLatRing {
  const open = openRing(ring);
  if (open.length < 3) return open;
  const first = open[0]!;
  return [...open, first];
}

function ringToPolygon(ring: LngLatRing): Feature<Polygon> | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return null;
  return polygon([closed]);
}

/**
 * Designable "Canvas Canvas": title parcel minus building footprints and
 * optional exclude rings (easements / existing hardscapes).
 * Returns outer ring(s) of the difference polygon, or the parcel if empty.
 */
export function designableCanvas(
  parcelRing: LngLatRing,
  buildingRings: LngLatRing[] = [],
  excludeRings: LngLatRing[] = [],
): LngLatRing[] {
  const parcel = ringToPolygon(parcelRing);
  if (!parcel) return [];

  const subtractors = [...buildingRings, ...excludeRings]
    .map(ringToPolygon)
    .filter((f): f is Feature<Polygon> => f != null);

  if (subtractors.length === 0) {
    return [openRing(parcelRing)];
  }

  let result: Feature<Polygon | MultiPolygon> | null = parcel;
  for (const b of subtractors) {
    if (!result) break;
    const next = difference(featureCollection([result, b]));
    result = next;
  }

  if (!result) return [openRing(parcelRing)];

  const geom = result.geometry;
  if (geom.type === "Polygon") {
    const outer = geom.coordinates[0];
    if (!outer || outer.length < 3) return [openRing(parcelRing)];
    return [openRing(outer as LngLatRing)];
  }

  // MultiPolygon - return each outer ring
  const rings: LngLatRing[] = [];
  for (const poly of geom.coordinates) {
    const outer = poly[0];
    if (outer && outer.length >= 3) rings.push(openRing(outer as LngLatRing));
  }
  return rings.length ? rings : [openRing(parcelRing)];
}

/**
 * Outside-dim mask: world covering polygon with a hole at the title parcel.
 * Drop-in for GeoSiteMap mask GeoJSON Feature.
 */
export function outsideMask(
  parcelRing: LngLatRing,
): Feature<Polygon | MultiPolygon> | null {
  const parcel = ringToPolygon(parcelRing);
  if (!parcel) return null;
  return mask(parcel);
}

/** Primary designable focus ring (largest outer ring from designableCanvas). */
export function designableFocusRing(
  parcelRing: LngLatRing,
  buildingRings: LngLatRing[] = [],
): LngLatRing {
  const rings = designableCanvas(parcelRing, buildingRings);
  if (!rings.length) return openRing(parcelRing);
  // Prefer ring with most vertices (usually the main garden remnant)
  return rings.reduce((best, r) => (r.length > best.length ? r : best), rings[0]!);
}

/**
 * Inward council setback ring (default 1.5 m) from a parcel polygon.
 * Uses Turf buffer in metres; returns null when buffering collapses the lot.
 */
export function inwardSetbackRing(
  parcelRing: LngLatRing,
  setbackM = 1.5,
): LngLatRing | null {
  const poly = ringToPolygon(parcelRing);
  if (!poly || setbackM <= 0) return null;
  try {
    const buffered = buffer(poly, -setbackM, { units: "meters" });
    if (!buffered) return null;
    const geom = buffered.geometry;
    if (geom.type === "Polygon") {
      const outer = geom.coordinates[0];
      if (!outer || outer.length < 4) return null;
      return openRing(outer as LngLatRing);
    }
    if (geom.type === "MultiPolygon") {
      let best: LngLatRing | null = null;
      for (const part of geom.coordinates) {
        const outer = part[0];
        if (!outer || outer.length < 4) continue;
        const ring = openRing(outer as LngLatRing);
        if (!best || ring.length > best.length) best = ring;
      }
      return best;
    }
  } catch {
    return null;
  }
  return null;
}

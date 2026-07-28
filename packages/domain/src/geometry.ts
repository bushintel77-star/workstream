/**
 * Geometry helpers for lat/lng polygons.
 *
 * Uses an equirectangular projection centred on the polygon centroid:
 * accurate to <0.5% for parcels under ~1km, fine for residential lots.
 * For larger areas, switch to a proper UTM/MGA projection.
 */

export type LngLat = [number, number];

const METERS_PER_DEG_LAT = 110_540;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function centroid(coords: LngLat[]): { lat: number; lng: number } {
  let sumLng = 0;
  let sumLat = 0;
  let n = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
    n += 1;
  }
  return { lng: sumLng / n, lat: sumLat / n };
}

function projectToMeters(
  coords: LngLat[],
): { x: number; y: number }[] {
  if (coords.length === 0) return [];
  const c = centroid(coords);
  const mPerLng = metersPerDegLng(c.lat);
  return coords.map(([lng, lat]) => ({
    x: (lng - c.lng) * mPerLng,
    y: (lat - c.lat) * METERS_PER_DEG_LAT,
  }));
}

/** Shoelace formula for polygon area in m². Accepts an open or closed ring. */
export function polygonArea(coords: LngLat[]): number {
  if (coords.length < 3) return 0;
  const projected = projectToMeters(coords);
  let sum = 0;
  const n = projected.length;
  for (let i = 0; i < n; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Sum of edge lengths in metres. */
export function polygonPerimeter(coords: LngLat[]): number {
  if (coords.length < 2) return 0;
  const projected = projectToMeters(coords);
  let total = 0;
  const n = projected.length;
  for (let i = 0; i < n; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Per-edge length (m) and bearing (degrees clockwise from north). */
export function edgeLengths(
  coords: LngLat[],
): { length_m: number; bearing_deg: number }[] {
  if (coords.length < 2) return [];
  const closed =
    coords.length >= 2 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];
  const ring = closed ? coords.slice(0, -1) : coords;
  const projected = projectToMeters(ring);
  const out: { length_m: number; bearing_deg: number }[] = [];
  const n = projected.length;
  for (let i = 0; i < n; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length_m = Math.hypot(dx, dy);
    // bearing: 0° = north (+y), 90° = east (+x), clockwise
    let bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (bearing < 0) bearing += 360;
    out.push({
      length_m: Math.round(length_m * 10) / 10,
      bearing_deg: Math.round(bearing),
    });
  }
  return out;
}

/** Bounding box [minLng, minLat, maxLng, maxLat]. */
export function bbox(coords: LngLat[]): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Outdoor workspace span from title/lot ring (metres).
 * Prefer this over full aerial tile when sizing CAD templates.
 */
export function outdoorWorkspaceSpan(args: {
  titleRing?: LngLat[] | null;
  garden_area_m2: number;
  lot_area_m2?: number;
}): { width_m: number; height_m: number; outdoor_area_m2: number } {
  const outdoor_area_m2 = Math.max(
    0,
    args.garden_area_m2 || args.lot_area_m2 || 0,
  );

  const ring = args.titleRing;
  if (ring && ring.length >= 3) {
    const [minLng, minLat, maxLng, maxLat] = bbox(ring);
    const midLat = (minLat + maxLat) / 2;
    const width_m = Math.abs(maxLng - minLng) * metersPerDegLng(midLat);
    const height_m = Math.abs(maxLat - minLat) * METERS_PER_DEG_LAT;
    if (width_m >= 2 && height_m >= 2) {
      return {
        width_m: Math.round(width_m * 10) / 10,
        height_m: Math.round(height_m * 10) / 10,
        outdoor_area_m2:
          outdoor_area_m2 > 0
            ? Math.round(outdoor_area_m2)
            : Math.round(width_m * height_m),
      };
    }
  }

  // No title ring and no surveyed area — do not invent an 80 m² lot.
  // Callers (groundSpanFromSurvey) fall through to Mapbox aerial span.
  if (outdoor_area_m2 <= 0) {
    return { width_m: 0, height_m: 0, outdoor_area_m2: 0 };
  }
  const side = Math.sqrt(outdoor_area_m2);
  return {
    width_m: Math.round(side * 1.25 * 10) / 10,
    height_m: Math.round(side * 0.8 * 10) / 10,
    outdoor_area_m2: Math.round(outdoor_area_m2),
  };
}

/**
 * Polygon difference stub. Garden = title minus house. Implementing a
 * full polygon-clipping (Vatti, Greiner-Hormann) is meaningful work; the
 * survey-job currently uses the title polygon with house-as-inner-ring
 * to side-step this. Kept here so callers have a stable signature.
 */
export function subtractPolygon(
  outer: LngLat[],
  _inner: LngLat[],
): LngLat[] {
  return outer;
}

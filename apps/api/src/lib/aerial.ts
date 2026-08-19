/**
 * Aerial imagery for surveys, confirm-pin and the portal hero.
 *
 * Resolution chain (all keyless):
 *   - Esri World Imagery export — sub-metre mosaic (verified live 2026-08-19)
 *   - StateView ortho WMS — Victorian government 1.5 m satellite, served by
 *     the DELWP GeoServer (fallback when the Vic Gov source is preferred)
 *
 * The developer.vic WoVG key (DATAVIC_API_KEY) will slot in above Esri when
 * the Vicmap Coordinated Imagery Program endpoint is wired — see env.ts.
 */

const ESRI_EXPORT =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
const STATEVIEW_WMS = "https://opendata.maps.vic.gov.au/geoserver/wms";
const STATEVIEW_LAYER = "open-data-platform:stateview_2024_sat_ortho_150cm";

export type LngLatRing = [number, number][];

type Bbox = { minLng: number; maxLng: number; minLat: number; maxLat: number };

/** Aspect-preserving bbox around a point for a given longitude span. */
function bboxAroundPoint(
  lat: number,
  lng: number,
  spanDeg: number,
  width: number,
  height: number,
): Bbox {
  const latSpan = spanDeg * (height / Math.max(width, 1));
  return {
    minLng: lng - spanDeg / 2,
    maxLng: lng + spanDeg / 2,
    minLat: lat - latSpan / 2,
    maxLat: lat + latSpan / 2,
  };
}

/** Aspect-preserving bbox fitted to a title ring with a context margin. */
function bboxForRing(ring: LngLatRing, width: number, height: number): Bbox | null {
  const valid = ring.filter(
    ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
  );
  if (valid.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of valid) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const pad = 0.18;
  const spanLng = Math.max(maxLng - minLng, 0.0005) * (1 + pad);
  const spanLat = Math.max(maxLat - minLat, 0.0005) * (1 + pad);
  const aspect = width / Math.max(height, 1);
  const centreLng = (minLng + maxLng) / 2;
  const centreLat = (minLat + maxLat) / 2;
  const fitSpanLng = Math.max(spanLng, spanLat * aspect);
  const fitSpanLat = fitSpanLng / aspect;

  return {
    minLng: centreLng - fitSpanLng / 2,
    maxLng: centreLng + fitSpanLng / 2,
    minLat: centreLat - fitSpanLat / 2,
    maxLat: centreLat + fitSpanLat / 2,
  };
}

function esriUrl(box: Bbox, width: number, height: number): string {
  const p = new URLSearchParams({
    bbox: `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`,
    size: `${width},${height}`,
    format: "png32",
    f: "image",
    bboxSR: "4326",
    imageSR: "4326",
  });
  return `${ESRI_EXPORT}?${p.toString()}`;
}

function stateViewUrl(box: Bbox, width: number, height: number): string {
  const p = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: STATEVIEW_LAYER,
    styles: "",
    format: "image/png",
    transparent: "false",
    width: String(width),
    height: String(height),
    crs: "EPSG:4326",
  });
  p.set("bbox", `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`);
  return `${STATEVIEW_WMS}?${p.toString()}`;
}

/**
 * Point-centred ortho view. `zoom` keeps the historical call-site semantics:
 * 17 ≈ neighbourhood (~1.8 km), 20 ≈ lot (~230 m).
 */
export function aerialImageUrl(
  lat: number,
  lng: number,
  width = 600,
  height = 600,
  zoom = 19,
): string {
  const spanDeg = 0.03 / 2 ** (zoom - 17);
  return esriUrl(bboxAroundPoint(lat, lng, spanDeg, width, height), width, height);
}

/**
 * Ortho view fitted to the actual title parcel ring rather than the
 * geocoder's point (the pin can land on a frontage or neighbouring roof).
 */
export function aerialImageUrlForRing(
  ring: LngLatRing,
  width = 800,
  height = 480,
): string | null {
  const box = bboxForRing(ring, width, height);
  if (!box) return null;
  return esriUrl(box, width, height);
}

/** Victorian government fallback — 1.5 m StateView ortho via the keyless WMS. */
export function stateViewAerialImageUrlForRing(
  ring: LngLatRing,
  width = 800,
  height = 480,
): string | null {
  const box = bboxForRing(ring, width, height);
  if (!box) return null;
  return stateViewUrl(box, width, height);
}

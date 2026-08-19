/**
 * Keyless Victorian aerial imagery — StateView satellite orthophoto (1.5 m),
 * served by the DELWP GeoServer WMS. Replaces the retired Mapbox Static
 * satellite (2026-08-19) at zero cost and with no API key.
 *
 * Honesty: StateView is 1.5 m satellite ortho, not sub-metre aerial. The
 * sharper upgrade path is Vicmap CIP imagery via the free DataVic API key.
 */

const WMS_BASE = "https://opendata.maps.vic.gov.au/geoserver/wms";
const ORTHO_LAYER = "open-data-platform:stateview_2024_sat_ortho_150cm";

export type LngLatRing = [number, number][];

type Bbox = { minLng: number; maxLng: number; minLat: number; maxLat: number };

function wmsUrl(box: Bbox, width: number, height: number): string {
  const p = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: ORTHO_LAYER,
    styles: "",
    format: "image/png",
    transparent: "false",
    width: String(width),
    height: String(height),
    crs: "EPSG:4326",
  });
  p.set("bbox", `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`);
  return `${WMS_BASE}?${p.toString()}`;
}

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

/**
 * Point-centred ortho view. `zoom` keeps the retired Mapbox call-site
 * semantics: 17 ≈ neighbourhood (~1.8 km), 20 ≈ lot (~230 m).
 */
export function aerialImageUrl(
  lat: number,
  lng: number,
  width = 600,
  height = 600,
  zoom = 19,
): string {
  const spanDeg = 0.03 / 2 ** (zoom - 17);
  return wmsUrl(bboxAroundPoint(lat, lng, spanDeg, width, height), width, height);
}

/**
 * Ortho view fitted to the actual title parcel ring rather than the
 * geocoder's point (the pin can land on a frontage or neighbouring roof).
 * Aspect-preserving: the bbox is padded to the width/height ratio so the
 * WMS never stretches the parcel.
 */
export function aerialImageUrlForRing(
  ring: LngLatRing,
  width = 800,
  height = 480,
): string | null {
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

  const pad = 0.18; // 18% context margin around the parcel
  const spanLng = Math.max(maxLng - minLng, 0.0005) * (1 + pad);
  const spanLat = Math.max(maxLat - minLat, 0.0005) * (1 + pad);
  const aspect = width / Math.max(height, 1);
  const centreLng = (minLng + maxLng) / 2;
  const centreLat = (minLat + maxLat) / 2;

  // Fit the parcel's aspect into the requested frame without stretching.
  const fitSpanLng = Math.max(spanLng, spanLat * aspect);
  const fitSpanLat = fitSpanLng / aspect;

  return wmsUrl(
    {
      minLng: centreLng - fitSpanLng / 2,
      maxLng: centreLng + fitSpanLng / 2,
      minLat: centreLat - fitSpanLat / 2,
      maxLat: centreLat + fitSpanLat / 2,
    },
    width,
    height,
  );
}

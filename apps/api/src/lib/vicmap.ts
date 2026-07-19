import type { GeoJsonPolygon } from "@workstream/contracts";
import { polygonArea, type VicmapParcelAttrs } from "@workstream/domain";

const WFS_BASE = "https://opendata.maps.vic.gov.au/geoserver/wfs";

const COMMON_PARAMS = {
  service: "WFS",
  version: "2.0.0",
  request: "GetFeature",
  outputFormat: "application/json",
  srsName: "EPSG:4326",
  count: "20",
};

type Coord = [number, number];
type Ring = Coord[];

type RawGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type RawFeature = {
  type: "Feature";
  geometry: RawGeometry;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: RawFeature[];
};

export type VicmapTitleParcel = {
  polygon: GeoJsonPolygon;
  attrs: VicmapParcelAttrs;
};

export function isVicmapEnabled(): boolean {
  return process.env.VICMAP_ENABLED === "true";
}

function buildUrl(typeName: string, cqlFilter: string): string {
  const params = new URLSearchParams({
    ...COMMON_PARAMS,
    typeNames: typeName,
    CQL_FILTER: cqlFilter,
  });
  return `${WFS_BASE}?${params.toString()}`;
}

async function wfsFetch(url: string): Promise<FeatureCollection> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Vicmap WFS ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as FeatureCollection;
}

function largestPolygonRing(geom: RawGeometry): Ring | null {
  if (geom.type === "Polygon") {
    return geom.coordinates[0] ?? null;
  }
  let best: Ring | null = null;
  let bestArea = 0;
  for (const poly of geom.coordinates) {
    const ring = poly[0];
    if (!ring) continue;
    const area = polygonArea(ring as Coord[]);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

function toGeoJsonPolygon(ring: Ring): GeoJsonPolygon {
  return { type: "Polygon", coordinates: [ring] };
}

function propStr(
  props: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  if (!props) return null;
  const lower = new Map(
    Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return null;
}

/** Extract cadastral labels from Vicmap property_view attributes. */
export function extractVicmapParcelAttrs(
  props: Record<string, unknown> | undefined,
  lotAreaM2: number,
): VicmapParcelAttrs {
  return {
    pfi: propStr(props, "PROP_PFI", "PROPV_PFI", "prop_pfi", "propv_pfi", "PFI"),
    propNum: propStr(
      props,
      "PROP_PROPNUM",
      "PROPNUM",
      "prop_propnum",
      "propnum",
    ),
    spi: propStr(props, "SPI", "PARCEL_SPI", "spi", "parcel_spi"),
    lgaCode: propStr(
      props,
      "PROP_LGA_CODE",
      "LGA_CODE",
      "prop_lga_code",
      "lga_code",
    ),
    lotAreaM2: lotAreaM2 > 0 ? lotAreaM2 : null,
  };
}

/**
 * Fetch the property polygon + cadastral attributes enclosing a lat/lng.
 * Returns null on miss.
 */
export async function fetchTitleParcel(
  lat: number,
  lng: number,
): Promise<VicmapTitleParcel | null> {
  const cql = `INTERSECTS(geom, SRID=4326;POINT(${lng} ${lat}))`;
  const url = buildUrl("open-data-platform:property_view", cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  let best: RawFeature | null = null;
  let bestRing: Ring | null = null;
  let bestArea = 0;
  for (const f of fc.features) {
    const ring = largestPolygonRing(f.geometry);
    if (!ring) continue;
    const area = polygonArea(ring as Coord[]);
    if (area > bestArea) {
      best = f;
      bestRing = ring;
      bestArea = area;
    }
  }
  if (!best || !bestRing) return null;

  const lotAreaM2 = Math.round(bestArea);
  return {
    polygon: toGeoJsonPolygon(bestRing),
    attrs: extractVicmapParcelAttrs(best.properties, lotAreaM2),
  };
}

/** Fetch the property polygon enclosing a lat/lng. Returns null on miss. */
export async function fetchTitlePolygon(
  lat: number,
  lng: number,
): Promise<GeoJsonPolygon | null> {
  const parcel = await fetchTitleParcel(lat, lng);
  return parcel?.polygon ?? null;
}

/** Fetch the building footprint(s) intersecting a property polygon. Returns the
 * largest one as a Polygon. Returns null if no buildings found. */
export async function fetchBuildingPolygon(
  titleRing: Ring,
): Promise<GeoJsonPolygon | null> {
  const wkt = `POLYGON((${titleRing
    .map(([x, y]) => `${x} ${y}`)
    .join(", ")}))`;
  const cql = `INTERSECTS(geom, SRID=4326;${wkt})`;
  const url = buildUrl("open-data-platform:building_polygon", cql);
  const fc = await wfsFetch(url);
  if (fc.features.length === 0) return null;

  let bestRing: Ring | null = null;
  let bestArea = 0;
  for (const f of fc.features) {
    const ring = largestPolygonRing(f.geometry);
    if (!ring) continue;
    const area = polygonArea(ring as Coord[]);
    if (area > bestArea) {
      bestRing = ring;
      bestArea = area;
    }
  }
  return bestRing ? toGeoJsonPolygon(bestRing) : null;
}

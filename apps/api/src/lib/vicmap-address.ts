/**
 * Keyless Vicmap Address (GNAF) geocoding — the authoritative Victorian
 * address source, served free on the DELWP GeoServer WFS (no API key), the
 * same endpoint the cadastral hydrate uses.
 *
 * `ezi_address ILIKE` search over the `open-data-platform:address` layer;
 * results carry the GNAF point geometry. This replaces the Mapbox geocoder
 * for the product (Victoria-only by design); non-Victorian queries fall
 * through to Nominatim in mapbox.ts.
 */

import { fetchWithRetry } from "./http";

const WFS_BASE = "https://opendata.maps.vic.gov.au/geoserver/wfs";

export type AddressSuggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

/** CQL literal escape — double any single quote (O'Brien St). */
function cqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

type VicmapAddressFeature = {
  properties: {
    ufi?: number;
    pfi?: string;
    ezi_address?: string;
    label_address?: string;
    is_primary?: string;
    locality_name?: string;
    postcode?: string;
  };
  geometry?: { type?: string; coordinates?: unknown };
};

function lngLatOf(geometry: VicmapAddressFeature["geometry"]): {
  lat: number;
  lng: number;
} | null {
  if (!geometry || geometry.type !== "Point") return null;
  const c = geometry.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lng, lat] = c as [number, number];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lat, lng };
}

async function queryAddresses(
  cqlFilter: string,
  limit: number,
): Promise<VicmapAddressFeature[]> {
  const url =
    `${WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=open-data-platform:address&outputFormat=application/json` +
    `&count=${Math.min(Math.max(limit, 1), 10)}` +
    // No propertyName filter: the point geometry must ride along for the
    // lat/lng mapping, and GeoServer omits it when listed attributes omit it.
    `&cql_filter=${encodeURIComponent(cqlFilter)}`;

  const res = await fetchWithRetry(
    url,
    { headers: { Accept: "application/json" } },
    {
      telemetry: {
        spanName: "vicmap.address_wfs",
        provider: "external",
        attributes: {
          "pipeline.stage": "survey",
          "geocode.provider": "vicmap-address",
        },
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Vicmap address WFS failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { features?: VicmapAddressFeature[] };
  return json.features ?? [];
}

/** Primary-flagged addresses first, then whatever GNAF gave us. */
function primaryFirst(features: VicmapAddressFeature[]): VicmapAddressFeature[] {
  return [...features].sort((a, b) => {
    const pa = a.properties.is_primary === "Y" ? 0 : 1;
    const pb = b.properties.is_primary === "Y" ? 0 : 1;
    return pa - pb;
  });
}

export async function searchVicmapAddresses(
  query: string,
  limit = 6,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const cql = `ezi_address ILIKE '%${cqlLiteral(trimmed)}%'`;
  const features = primaryFirst(await queryAddresses(cql, limit));
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const pos = lngLatOf(f.geometry);
    if (!pos) continue;
    // ezi_address is the canonical formatted GNAF address; label_address is
    // a flag field ('Y'/'N') in this dataset, not a human label.
    const label = f.properties.ezi_address?.trim() || "";
    if (!label) continue;
    out.push({
      id: `vicmap:${f.properties.pfi ?? f.properties.ufi ?? label}`,
      place_name: label,
      text: label,
      ...pos,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function geocodeVicmapAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (trimmed.length < 5) return null;

  // Drop the "VIC 3181" tail when present so the street match drives the
  // query; the ezi_address ILIKE is tolerant either way.
  const streetQuery = trimmed.replace(/\b(VIC|VICTORIA)\s+\d{4}\b\s*$/i, "").trim();
  const cql = `ezi_address ILIKE '%${cqlLiteral(streetQuery)}%'`;
  const features = primaryFirst(await queryAddresses(cql, 5));

  for (const f of features) {
    const pos = lngLatOf(f.geometry);
    if (pos) return pos;
  }
  return null;
}

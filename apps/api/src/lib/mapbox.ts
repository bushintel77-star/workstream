import { getOwnerEnv } from "./owner-secrets";
import { fetchWithRetry } from "./http";

const MAPBOX_GEOCODE_URL =
  "https://api.mapbox.com/geocoding/v5/mapbox.places";
const MAPBOX_STATIC_URL =
  "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const DEV_FALLBACK_LATLNG = { lat: -37.8497, lng: 145.0189 };

export type GeocodeResult = { lat: number; lng: number };

export type GeocodeSuggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

async function nominatimSearch(
  query: string,
  limit: number,
): Promise<GeocodeSuggestion[]> {
  const url =
    `${NOMINATIM_URL}?format=jsonv2` +
    `&q=${encodeURIComponent(query)}` +
    `&countrycodes=au&addressdetails=1` +
    `&limit=${Math.min(Math.max(limit, 1), 10)}`;

  const res = await fetchWithRetry(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkstreamCurtisCo/1.0 (local-dev geocode fallback)",
      },
    },
    {
      telemetry: {
        spanName: "nominatim.geocode_search",
        provider: "external",
        attributes: {
          "pipeline.stage": "survey",
          "geocode.provider": "nominatim",
        },
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `Nominatim autocomplete failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
  }>;
  return json.map((f) => ({
    id: `nominatim:${f.place_id}`,
    place_name: f.display_name,
    text: f.name?.trim() || f.display_name.split(",")[0] || f.display_name,
    lat: Number(f.lat),
    lng: Number(f.lon),
  }));
}

export async function geocodeSearch(
  query: string,
  limit = 5,
): Promise<GeocodeSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const token = getOwnerEnv("MAPBOX_TOKEN");
  if (!token) {
    return nominatimSearch(trimmed, limit);
  }

  const url =
    `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(trimmed)}.json` +
    `?access_token=${token}` +
    `&country=AU&autocomplete=true&types=address,place` +
    `&limit=${Math.min(Math.max(limit, 1), 10)}`;

  const res = await fetchWithRetry(
    url,
    {},
    {
      telemetry: {
        spanName: "mapbox.geocode_search",
        provider: "mapbox",
        attributes: {
          "pipeline.stage": "survey",
        },
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `Mapbox autocomplete failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    features: Array<{
      id: string;
      place_name: string;
      text: string;
      center: [number, number];
    }>;
  };
  const mapped = json.features.map((f) => ({
    id: f.id,
    place_name: f.place_name,
    text: f.text,
    lng: f.center[0],
    lat: f.center[1],
  }));
  if (mapped.length > 0) return mapped;
  // Mapbox empty → try Nominatim before giving up
  return nominatimSearch(trimmed, limit);
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const token = getOwnerEnv("MAPBOX_TOKEN");
  if (!token) {
    const hits = await nominatimSearch(address, 1).catch(() => []);
    if (hits[0]) return { lat: hits[0].lat, lng: hits[0].lng };
    return DEV_FALLBACK_LATLNG;
  }

  const url =
    `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(address)}.json` +
    `?access_token=${token}&country=AU&limit=1`;

  const res = await fetchWithRetry(
    url,
    {},
    {
      telemetry: {
        spanName: "mapbox.geocode_address",
        provider: "mapbox",
        attributes: {
          "pipeline.stage": "survey",
        },
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Mapbox geocode failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    features: Array<{ center: [number, number] }>;
  };
  const feature = json.features[0];
  if (!feature) {
    const hits = await nominatimSearch(address, 1).catch(() => []);
    if (hits[0]) return { lat: hits[0].lat, lng: hits[0].lng };
    throw new Error(`Mapbox geocode: no results for "${address}"`);
  }
  const [lng, lat] = feature.center;
  return { lat, lng };
}

export function aerialImageUrl(
  lat: number,
  lng: number,
  width = 600,
  height = 600,
  zoom = 19,
): string {
  const token = getOwnerEnv("MAPBOX_TOKEN");
  if (!token) {
    return `https://placeholder.aerial/satellite/${lat},${lng}?z=${zoom}&w=${width}&h=${height}`;
  }
  return (
    `${MAPBOX_STATIC_URL}/${lng},${lat},${zoom},0/${width}x${height}@2x` +
    `?access_token=${token}`
  );
}

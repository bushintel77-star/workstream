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

function lngLatToWorldPx(
  lng: number,
  lat: number,
  zoom: number,
): [number, number] {
  const scale = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI) / 180;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    scale;
  return [x, y];
}

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
    address?: {
      house_number?: string;
      road?: string;
      suburb?: string;
      city?: string;
      town?: string;
      state?: string;
    };
  }>;
  return json.map((f) => {
    const a = f.address;
    const street = [a?.house_number, a?.road].filter(Boolean).join(" ").trim();
    const locality = a?.suburb || a?.town || a?.city || "";
    const label =
      street && locality
        ? `${street}, ${locality}`
        : street || f.name?.trim() || f.display_name.split(",")[0] || f.display_name;
    return {
      id: `nominatim:${f.place_id}`,
      place_name: f.display_name,
      text: label,
      lat: Number(f.lat),
      lng: Number(f.lon),
    };
  });
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

export type AerialImageOpts = {
  /** Drop a Mapbox Static pin on the geocode centre (confirm-lot UX). */
  pin?: boolean;
};

export type LngLatRing = [number, number][];

function ringBounds(ring: LngLatRing) {
  const valid = ring.filter(
    ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
  );
  if (valid.length === 0) return null;
  return valid.reduce(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      maxLng: Math.max(bounds.maxLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    {
      minLng: valid[0]![0],
      maxLng: valid[0]![0],
      minLat: valid[0]![1],
      maxLat: valid[0]![1],
    },
  );
}

/**
 * Build a static view around the actual title parcel rather than the
 * geocoder's point. The pin can land on a frontage or neighbouring roof;
 * the cadastral ring is the authoritative footprint for aerial capture.
 */
export function aerialImageUrlForRing(
  ring: LngLatRing,
  width = 800,
  height = 480,
  opts: AerialImageOpts = {},
): string | null {
  const bounds = ringBounds(ring);
  if (!bounds) return null;

  const centreLng = (bounds.minLng + bounds.maxLng) / 2;
  const centreLat = (bounds.minLat + bounds.maxLat) / 2;
  const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.00001);
  const usableWidth = width * 0.78;
  const usableHeight = height * 0.78;
  const zoomX = Math.log2((usableWidth * 360) / (256 * spanLng));
  const northMin = lngLatToWorldPx(centreLng, bounds.maxLat, 0)[1];
  const southMax = lngLatToWorldPx(centreLng, bounds.minLat, 0)[1];
  const zoomY = Math.log2(
    usableHeight / Math.max(Math.abs(southMax - northMin), 0.00001),
  );
  const zoom = Math.max(16, Math.min(21, Math.floor(Math.min(zoomX, zoomY))));
  return aerialImageUrl(centreLat, centreLng, width, height, zoom, opts);
}

export function aerialImageUrl(
  lat: number,
  lng: number,
  width = 600,
  height = 600,
  zoom = 19,
  opts: AerialImageOpts = {},
): string {
  const token = getOwnerEnv("MAPBOX_TOKEN");
  // Curtis terracotta — readable on satellite without competing with roofs.
  const overlay = opts.pin ? `pin-l+c45c26(${lng},${lat})/` : "";
  if (!token) {
    const pinQ = opts.pin ? "&pin=1" : "";
    return `https://placeholder.aerial/satellite/${lat},${lng}?z=${zoom}&w=${width}&h=${height}${pinQ}`;
  }
  return (
    `${MAPBOX_STATIC_URL}/${overlay}${lng},${lat},${zoom},0/${width}x${height}@2x` +
    `?access_token=${token}`
  );
}

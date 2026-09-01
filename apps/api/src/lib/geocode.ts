/**
 * Address geocoding — keyless Victorian GNAF first, Nominatim fallback.
 * The Mapbox geocoder was retired 2026-08-19 in favour of the authoritative
 * free sources (see vicmap-address.ts).
 */

import { fetchWithRetry } from "./http";
import { geocodeVicmapAddress, searchVicmapAddresses } from "./vicmap-address";

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
      // Nominatim's public API rate-limits aggressively; a hung lookup must
      // not stall the survey pipeline for the http wrapper default
      // (30 s × 3 attempts). One 8 s attempt matches the vicmap-address
      // precedent — fail fast and let the caller fall back.
      timeoutMs: 8_000,
      retries: 1,
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

  // Victorian authoritative GNAF first (keyless DELWP WFS), then Nominatim.
  const vic = await searchVicmapAddresses(trimmed, limit).catch(() => []);
  if (vic.length > 0) return vic;
  return nominatimSearch(trimmed, limit);
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const vic = await geocodeVicmapAddress(address).catch(() => null);
  if (vic) return vic;

  const hits = await nominatimSearch(address, 1).catch(() => []);
  if (hits[0]) return { lat: hits[0].lat, lng: hits[0].lng };
  return DEV_FALLBACK_LATLNG;
}

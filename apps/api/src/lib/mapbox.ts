const MAPBOX_GEOCODE_URL =
  "https://api.mapbox.com/geocoding/v5/mapbox.places";
const MAPBOX_STATIC_URL =
  "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static";

const DEV_FALLBACK_LATLNG = { lat: -37.8497, lng: 145.0189 };

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return DEV_FALLBACK_LATLNG;
  }

  const url =
    `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(address)}.json` +
    `?access_token=${token}&country=AU&limit=1`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox geocode failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    features: Array<{ center: [number, number] }>;
  };
  const feature = json.features[0];
  if (!feature) {
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
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return `https://placeholder.aerial/satellite/${lat},${lng}?z=${zoom}&w=${width}&h=${height}`;
  }
  return (
    `${MAPBOX_STATIC_URL}/${lng},${lat},${zoom},0/${width}x${height}@2x` +
    `?access_token=${token}`
  );
}

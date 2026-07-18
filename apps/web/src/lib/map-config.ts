export type MapConfig = {
  /** Optional — demotiles / Esri raster styles work without a token. */
  token: string | null;
  styles: { satellite: string; streets: string };
  default_style: string;
};

const FALLBACK: MapConfig = {
  token: null,
  styles: {
    // Esri World Imagery via local MapLibre style JSON (see /api/map-style/satellite)
    satellite: "/api/map-style/satellite",
    // MapLibre demotiles — free, no token. OpenFreeMap liberty is a good prod swap.
    streets: "https://demotiles.maplibre.org/style.json",
  },
  default_style: "/api/map-style/satellite",
};

let cached: MapConfig | null = null;

export async function fetchMapConfig(): Promise<MapConfig> {
  if (cached) return cached;
  const res = await fetch("/api/map-config", { cache: "no-store" });
  if (!res.ok) {
    cached = FALLBACK;
    return cached;
  }
  const body = (await res.json()) as MapConfig;
  // Normalize legacy Mapbox style URLs if an older API still returns them
  const satellite = body.styles?.satellite?.startsWith("mapbox://")
    ? FALLBACK.styles.satellite
    : (body.styles?.satellite ?? FALLBACK.styles.satellite);
  const streets = body.styles?.streets?.startsWith("mapbox://")
    ? FALLBACK.styles.streets
    : (body.styles?.streets ?? FALLBACK.styles.streets);
  cached = {
    token: body.token ?? null,
    styles: { satellite, streets },
    default_style: body.default_style?.startsWith("mapbox://")
      ? satellite
      : (body.default_style ?? satellite),
  };
  return cached;
}

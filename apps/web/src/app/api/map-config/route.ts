import { operatorApiUrl } from "../../../lib/public-env";

/**
 * MapLibre GL style URLs (no Mapbox token required for demotiles / Esri raster).
 * - streets: MapLibre demotiles (vector demo) — swap to OpenFreeMap liberty for production polish
 * - satellite: local style JSON wrapping Esri World Imagery tiles (see /api/map-style/satellite)
 * Token remains optional for any future authenticated tile providers.
 */
const STREETS = "https://demotiles.maplibre.org/style.json";
const SATELLITE = "/api/map-style/satellite";

export async function GET() {
  const fromEnv = (
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    process.env.MAPBOX_TOKEN ??
    ""
  ).trim();

  const token = fromEnv.startsWith("pk.") ? fromEnv : null;

  try {
    const res = await fetch(`${operatorApiUrl()}/config/map`, {
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as {
        token: string | null;
        styles?: { satellite: string; streets: string };
        default_style?: string;
      };
      const styles = {
        satellite: body.styles?.satellite?.startsWith("mapbox://")
          ? SATELLITE
          : (body.styles?.satellite ?? SATELLITE),
        streets: body.styles?.streets?.startsWith("mapbox://")
          ? STREETS
          : (body.styles?.streets ?? STREETS),
      };
      return Response.json({
        token: token ?? body.token,
        styles,
        default_style: styles.satellite,
      });
    }
  } catch {
    /* fall through */
  }

  return Response.json({
    token,
    styles: { satellite: SATELLITE, streets: STREETS },
    default_style: SATELLITE,
  });
}

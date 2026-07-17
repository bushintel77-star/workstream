import type { Survey } from "@workstream/contracts";

const MAPBOX_TILE_PX = 256;

/** Parse Mapbox static satellite URL for ground span (mirrors web mapView). */
export function parseMapboxStaticAerial(uri: string): {
  lng: number;
  lat: number;
  zoom: number;
  width: number;
  height: number;
} | null {
  const match = uri.match(
    /\/static\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),0\/(\d+)x(\d+)/,
  );
  if (!match) return null;
  return {
    lng: Number(match[1]),
    lat: Number(match[2]),
    zoom: Number(match[3]),
    width: Number(match[4]),
    height: Number(match[5]),
  };
}

export function groundSpanFromSurvey(survey: Survey): {
  width_m: number;
  height_m: number;
} {
  const parsed = parseMapboxStaticAerial(survey.aerial_uri);
  if (parsed) {
    const latRad = (parsed.lat * Math.PI) / 180;
    const metresPerWorldPx =
      (40_075_016.686 * Math.cos(latRad)) /
      (MAPBOX_TILE_PX * 2 ** parsed.zoom);
    return {
      width_m: parsed.width * metresPerWorldPx,
      height_m: parsed.height * metresPerWorldPx,
    };
  }
  const area = survey.lot_area_m2 || survey.garden_area_m2 || 400;
  const side = Math.sqrt(Math.max(area, 100));
  return { width_m: side * 1.2, height_m: side };
}

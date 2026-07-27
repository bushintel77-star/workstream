import type { Survey } from "@workstream/contracts";
import { outdoorWorkspaceSpan, type LngLat } from "@workstream/domain";

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
    /\/static\/(?:[^/]+\/)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),0\/(\d+)x(\d+)/,
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

function aerialSpanMetres(survey: Survey): {
  width_m: number;
  height_m: number;
} | null {
  const parsed = parseMapboxStaticAerial(survey.aerial_uri);
  if (!parsed) return null;
  const latRad = (parsed.lat * Math.PI) / 180;
  const metresPerWorldPx =
    (40_075_016.686 * Math.cos(latRad)) /
    (MAPBOX_TILE_PX * 2 ** parsed.zoom);
  return {
    width_m: parsed.width * metresPerWorldPx,
    height_m: parsed.height * metresPerWorldPx,
  };
}

function titleRing(survey: Survey): LngLat[] | null {
  const ring = survey.title_polygon?.coordinates?.[0] as LngLat[] | undefined;
  return ring && ring.length >= 3 ? ring : null;
}

/**
 * CAD template size from outdoor (title/garden) area on the aerial survey.
 * Prefer lot title bbox metres; fall back to aerial frame, then ?garden area.
 */
export function groundSpanFromSurvey(survey: Survey): {
  width_m: number;
  height_m: number;
  outdoor_area_m2: number;
} {
  const outdoor = outdoorWorkspaceSpan({
    titleRing: titleRing(survey),
    garden_area_m2: survey.garden_area_m2,
    lot_area_m2: survey.lot_area_m2,
  });

  // Title/garden footprint is the CAD workspace when it looks like a real lot.
  if (outdoor.width_m >= 4 && outdoor.height_m >= 4) {
    return outdoor;
  }

  const aerial = aerialSpanMetres(survey);
  if (aerial) {
    return {
      ...aerial,
      outdoor_area_m2: outdoor.outdoor_area_m2,
    };
  }

  return outdoor;
}

import type { Survey } from "@workstream/contracts";
import { outdoorWorkspaceSpan, type LngLat } from "@workstream/domain";

const METRES_PER_DEG_LAT = 111_320;

/** Parse an aerial URI (Esri export or StateView WMS) for ground span. */
export function parseStaticAerial(uri: string): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  width: number;
  height: number;
} | null {
  try {
    const url = new URL(uri);
    const bbox = url.searchParams.get("bbox");
    if (!bbox) return null;
    let width: number;
    let height: number;
    const size = url.searchParams.get("size");
    if (size) {
      const [w, h] = size.split(",").map(Number);
      width = w;
      height = h;
    } else {
      width = Number(url.searchParams.get("width"));
      height = Number(url.searchParams.get("height"));
    }
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    if (
      ![minLng, minLat, maxLng, maxLat].every(Number.isFinite) ||
      maxLng <= minLng ||
      maxLat <= minLat
    ) {
      return null;
    }
    return { minLng, minLat, maxLng, maxLat, width, height };
  } catch {
    return null;
  }
}

function aerialSpanMetres(survey: Survey): {
  width_m: number;
  height_m: number;
} | null {
  const parsed = parseStaticAerial(survey.aerial_uri);
  if (!parsed) return null;
  const centreLat = ((parsed.minLat + parsed.maxLat) / 2) * (Math.PI / 180);
  return {
    width_m:
      (parsed.maxLng - parsed.minLng) * METRES_PER_DEG_LAT * Math.cos(centreLat),
    height_m: (parsed.maxLat - parsed.minLat) * METRES_PER_DEG_LAT,
  };
}

function titleRing(survey: Survey): LngLat[] | null {
  const ring = survey.title_polygon?.coordinates?.[0] as LngLat[] | undefined;
  return ring && ring.length >= 3 ? ring : null;
}

/**
 * CAD template size from outdoor (title/garden) area on the aerial survey.
 * Prefer lot title bbox metres; fall back to the ortho frame, then ≈garden area.
 */
export function groundSpanFromSurvey(survey: Survey): {
  width_m: number;
  height_m: number;
  outdoor_area_m2: number;
  fromAerial: boolean;
} {
  const outdoor = outdoorWorkspaceSpan({
    titleRing: titleRing(survey),
    garden_area_m2: survey.garden_area_m2,
    lot_area_m2: survey.lot_area_m2,
  });

  // Title/garden footprint is the CAD workspace when it looks like a real lot.
  if (outdoor.width_m >= 4 && outdoor.height_m >= 4) {
    return { ...outdoor, fromAerial: false };
  }

  const aerial = aerialSpanMetres(survey);
  if (aerial) {
    return {
      ...aerial,
      outdoor_area_m2: outdoor.outdoor_area_m2,
      fromAerial: true,
    };
  }

  return { ...outdoor, fromAerial: false };
}

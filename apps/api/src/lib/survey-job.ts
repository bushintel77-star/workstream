import type { Store } from "@workstream/db";
import type { GeoJsonPolygon, Survey } from "@workstream/contracts";
import {
  edgeLengths,
  gardenPolygonFromTitleAndHouse,
  polygonArea,
} from "@workstream/domain";
import { aerialImageUrl, aerialImageUrlForRing, geocodeAddress } from "./mapbox";
import { fetchBuildingPolygon, fetchTitleParcel } from "./vicmap";

type SurveyGeometry = {
  title_polygon: GeoJsonPolygon;
  house_polygon: GeoJsonPolygon;
  garden_polygon: GeoJsonPolygon;
  lot_area_m2: number;
  house_area_m2: number;
  garden_area_m2: number;
  measurements: Array<{
    edge_id: string;
    length_m: number;
    bearing_deg: number;
    label?: string;
  }>;
};

/** Aerial-only survey when Vicmap misses — Mapbox still grounds Trace / Calibrate. */
function buildAerialOnlyGeometry(): SurveyGeometry {
  const empty: GeoJsonPolygon = { type: "Polygon", coordinates: [] };
  return {
    title_polygon: empty,
    house_polygon: empty,
    garden_polygon: empty,
    lot_area_m2: 0,
    house_area_m2: 0,
    garden_area_m2: 0,
    measurements: [],
  };
}

function buildMeasurements(
  ring: [number, number][],
): Array<{ edge_id: string; length_m: number; bearing_deg: number; label?: string }> {
  const edges = edgeLengths(ring);
  if (edges.length === 0) return [];

  // Identify the four most distinctive edges by cycling the ring start to its
  // longest edge, then walking. Suburban lots are usually quadrilateral with
  // two long sides (depth) and two short (frontage). For irregular shapes we
  // still return all edges so the caller has something to render.
  return edges.map((e, i) => ({
    edge_id: `edge_${i + 1}`,
    length_m: e.length_m,
    bearing_deg: e.bearing_deg,
    label: `Edge ${i + 1}`,
  }));
}

async function buildVicmapGeometry(center: {
  lat: number;
  lng: number;
}): Promise<SurveyGeometry | null> {
  const titleParcel = await fetchTitleParcel(center.lat, center.lng);
  const titlePoly = titleParcel?.polygon ?? null;
  if (!titlePoly) return null;

  const titleRing = titlePoly.coordinates[0];
  if (!titleRing || titleRing.length < 4) return null;

  let housePoly: GeoJsonPolygon | null = null;
  try {
    housePoly = await fetchBuildingPolygon(titleRing);
  } catch (err) {
    console.warn("[vicmap] building lookup failed:", err);
  }

  const lotArea = Math.round(polygonArea(titleRing));
  const houseArea =
    housePoly && housePoly.coordinates[0]
      ? Math.round(polygonArea(housePoly.coordinates[0]))
      : 0;

  // The Vicmap building layer is existing-site context. If no footprint is
  // returned, preserve that uncertainty — never invent an architectural box.
  const house: GeoJsonPolygon = housePoly ?? {
    type: "Polygon",
    coordinates: [],
  };
  const houseRing = housePoly?.coordinates[0];

  const clipped = houseRing
    ? gardenPolygonFromTitleAndHouse(titleRing, houseRing)
    : null;

  return {
    title_polygon: titlePoly,
    house_polygon: house,
    garden_polygon:
      clipped?.polygon ?? { type: "Polygon", coordinates: [titleRing] },
    lot_area_m2: Math.max(1, lotArea),
    house_area_m2: Math.max(0, houseArea),
    garden_area_m2: clipped ? Math.max(0, clipped.areaM2) : Math.max(1, lotArea),
    measurements: buildMeasurements(titleRing),
  };
}

export async function runSurvey(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Survey> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const center =
    project.lat != null && project.lng != null
      ? { lat: project.lat, lng: project.lng }
      : await geocodeAddress(project.address);

  let geometry: SurveyGeometry | null = null;
  try {
    geometry = await buildVicmapGeometry(center);
  } catch (err) {
    console.warn(
      "[survey] Vicmap WFS failed — aerial only (Trace title on Mapbox):",
      err,
    );
  }
  if (!geometry) {
    geometry = buildAerialOnlyGeometry();
  }

  // Match locate-loader lot altitude — canvas design perspective.
  const aerial_uri =
    (geometry.title_polygon.coordinates[0]?.length
      ? aerialImageUrlForRing(
          geometry.title_polygon.coordinates[0] as [number, number][],
          800,
          480,
        )
      : null) ?? aerialImageUrl(center.lat, center.lng, 800, 480, 20);

  const survey = await store.upsertSurvey(ownerId, projectId, {
    aerial_uri,
    ...geometry,
  });

  await store.updateProjectStatus(ownerId, projectId, "survey_review");
  return survey;
}

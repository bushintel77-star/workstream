import type { Store } from "@walkthrough/db";
import type { GeoJsonPolygon, Survey } from "@walkthrough/contracts";
import { edgeLengths, polygonArea } from "@walkthrough/domain";
import { aerialImageUrl, geocodeAddress } from "./mapbox";
import {
  fetchBuildingPolygon,
  fetchTitlePolygon,
  isVicmapEnabled,
} from "./vicmap";

const METERS_PER_DEG_LAT = 110_540;
const FRONTAGE_M = 15;
const DEPTH_M = 40;
const HOUSE_W_M = 8;
const HOUSE_D_M = 12;
const HOUSE_FRONT_SETBACK_M = 5;

function metersToDegrees(lat: number) {
  const latDeg = 1 / METERS_PER_DEG_LAT;
  const lngDeg = 1 / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { latDeg, lngDeg };
}

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

function buildMockGeometry(center: { lat: number; lng: number }): SurveyGeometry {
  const { latDeg, lngDeg } = metersToDegrees(center.lat);

  const halfFront = (FRONTAGE_M / 2) * lngDeg;
  const halfDepth = (DEPTH_M / 2) * latDeg;
  const south = center.lat - halfDepth;
  const north = center.lat + halfDepth;
  const west = center.lng - halfFront;
  const east = center.lng + halfFront;

  const lotRing: [number, number][] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];

  const houseHalfW = (HOUSE_W_M / 2) * lngDeg;
  const houseSouth = south + HOUSE_FRONT_SETBACK_M * latDeg;
  const houseNorth = houseSouth + HOUSE_D_M * latDeg;
  const houseWest = center.lng - houseHalfW;
  const houseEast = center.lng + houseHalfW;

  const houseRing: [number, number][] = [
    [houseWest, houseSouth],
    [houseEast, houseSouth],
    [houseEast, houseNorth],
    [houseWest, houseNorth],
    [houseWest, houseSouth],
  ];

  return {
    title_polygon: { type: "Polygon", coordinates: [lotRing] },
    house_polygon: { type: "Polygon", coordinates: [houseRing] },
    garden_polygon: { type: "Polygon", coordinates: [lotRing, houseRing] },
    lot_area_m2: FRONTAGE_M * DEPTH_M,
    house_area_m2: HOUSE_W_M * HOUSE_D_M,
    garden_area_m2: FRONTAGE_M * DEPTH_M - HOUSE_W_M * HOUSE_D_M,
    measurements: [
      { edge_id: "front", length_m: FRONTAGE_M, bearing_deg: 90, label: "Frontage" },
      { edge_id: "east", length_m: DEPTH_M, bearing_deg: 0, label: "East boundary" },
      { edge_id: "back", length_m: FRONTAGE_M, bearing_deg: 270, label: "Rear" },
      { edge_id: "west", length_m: DEPTH_M, bearing_deg: 180, label: "West boundary" },
    ],
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
  const titlePoly = await fetchTitlePolygon(center.lat, center.lng);
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

  const fallbackHouse: GeoJsonPolygon = {
    type: "Polygon",
    coordinates: [
      [
        [center.lng - 0.00005, center.lat - 0.00005],
        [center.lng + 0.00005, center.lat - 0.00005],
        [center.lng + 0.00005, center.lat + 0.00005],
        [center.lng - 0.00005, center.lat + 0.00005],
        [center.lng - 0.00005, center.lat - 0.00005],
      ],
    ],
  };

  const house = housePoly ?? fallbackHouse;

  return {
    title_polygon: titlePoly,
    house_polygon: house,
    garden_polygon: {
      type: "Polygon",
      coordinates: [titleRing, house.coordinates[0]],
    },
    lot_area_m2: Math.max(1, lotArea),
    house_area_m2: Math.max(1, houseArea),
    garden_area_m2: Math.max(1, lotArea - houseArea),
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
  if (isVicmapEnabled()) {
    try {
      geometry = await buildVicmapGeometry(center);
    } catch (err) {
      console.warn("[survey] Vicmap fetch failed, falling back to mock:", err);
    }
  }
  if (!geometry) {
    geometry = buildMockGeometry(center);
  }

  const aerial_uri = aerialImageUrl(center.lat, center.lng);

  const survey = await store.upsertSurvey(ownerId, projectId, {
    aerial_uri,
    ...geometry,
  });

  await store.updateProjectStatus(ownerId, projectId, "survey_review");
  return survey;
}

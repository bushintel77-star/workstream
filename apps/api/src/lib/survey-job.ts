import type { Store } from "@walkthrough/db";
import type { Survey } from "@walkthrough/contracts";
import { aerialImageUrl, geocodeAddress } from "./mapbox";

const METERS_PER_DEG_LAT = 110_940;
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

function buildSurveyGeometry(center: { lat: number; lng: number }) {
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

  const lotArea = FRONTAGE_M * DEPTH_M;
  const houseArea = HOUSE_W_M * HOUSE_D_M;

  return {
    title_polygon: {
      type: "Polygon" as const,
      coordinates: [lotRing],
    },
    house_polygon: {
      type: "Polygon" as const,
      coordinates: [houseRing],
    },
    garden_polygon: {
      type: "Polygon" as const,
      coordinates: [lotRing, houseRing],
    },
    lot_area_m2: lotArea,
    house_area_m2: houseArea,
    garden_area_m2: lotArea - houseArea,
    measurements: [
      { edge_id: "front", length_m: FRONTAGE_M, bearing_deg: 90, label: "Frontage" },
      { edge_id: "east", length_m: DEPTH_M, bearing_deg: 0, label: "East boundary" },
      { edge_id: "back", length_m: FRONTAGE_M, bearing_deg: 270, label: "Rear" },
      { edge_id: "west", length_m: DEPTH_M, bearing_deg: 180, label: "West boundary" },
    ],
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

  const aerial_uri = aerialImageUrl(center.lat, center.lng);
  const geometry = buildSurveyGeometry(center);

  const survey = await store.upsertSurvey(ownerId, projectId, {
    aerial_uri,
    ...geometry,
  });

  await store.updateProjectStatus(ownerId, projectId, "survey_review");

  return survey;
}

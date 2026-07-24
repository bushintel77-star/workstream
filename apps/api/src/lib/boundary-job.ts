import type { Store } from "@workstream/db";
import type {
  BoundaryAutoTraceResponse,
  GeoJsonPolygon,
  SiteBoundary,
  UpsertSiteBoundaryInput,
} from "@workstream/contracts";
import {
  buildBoundaryFromPolygon,
  geoJsonLineToCanvasMetres,
  geoJsonPolygonToCanvasMetres,
  lockBoundary,
  unlockBoundary,
} from "@workstream/domain";
import {
  fetchBuildingPolygon,
  fetchEasementLinesForTitle,
  fetchTitlePolygon,
} from "./vicmap";

function toUpsert(
  draft: Omit<SiteBoundary, "id" | "updated_at">,
): UpsertSiteBoundaryInput {
  return {
    project_id: draft.project_id,
    layer_id: draft.layer_id,
    status: draft.status,
    last_modified_by: draft.last_modified_by,
    source_kind: draft.source_kind,
    geo_reference: draft.geo_reference,
    width_m: draft.width_m,
    height_m: draft.height_m,
    calculated_metrics: draft.calculated_metrics,
    vertices: draft.vertices,
  };
}

export async function getSiteBoundaryDoc(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<SiteBoundary | null> {
  return store.getSiteBoundary(ownerId, projectId);
}

export async function saveSiteBoundaryDoc(
  store: Store,
  ownerId: string,
  projectId: string,
  input: UpsertSiteBoundaryInput,
): Promise<SiteBoundary> {
  return store.upsertSiteBoundary(ownerId, projectId, {
    ...input,
    project_id: projectId,
  });
}

/** Auto-trace: keyless Vicmap WFS parcel, else survey title_polygon. */
export async function autoTraceSiteBoundary(
  store: Store,
  ownerId: string,
  projectId: string,
  preferGis = true,
): Promise<SiteBoundary> {
  const result = await autoTraceSiteBoundaryWithBuilding(
    store,
    ownerId,
    projectId,
    preferGis,
  );
  return result.boundary;
}

/**
 * Title auto-trace plus co-registered dwelling canvas-metre verts.
 * House comes from survey.house_polygon when present, else Vicmap building WFS.
 */
export async function autoTraceSiteBoundaryWithBuilding(
  store: Store,
  ownerId: string,
  projectId: string,
  preferGis = true,
): Promise<BoundaryAutoTraceResponse> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  let polygon: GeoJsonPolygon | null = null;
  let sourceKind: SiteBoundary["source_kind"] = "ai_trace";
  let source: "GIS_PARCEL" | "AI_GENERATED" = "AI_GENERATED";
  let confidence: number | null = 0.84;

  if (preferGis && project.lat != null && project.lng != null) {
    try {
      polygon = await fetchTitlePolygon(project.lat, project.lng);
      if (polygon) {
        sourceKind = "vicmap";
        source = "GIS_PARCEL";
        confidence = 0.97;
      }
    } catch (err) {
      console.warn("[boundary] Vicmap auto-trace failed:", err);
    }
  }

  const survey = await store.getSurvey(ownerId, projectId);

  if (!polygon) {
    if (survey?.title_polygon) {
      polygon = survey.title_polygon;
      // Survey job prefers Vicmap WFS; mock rectangle is the offline fallback.
      sourceKind = "vicmap";
      source = "GIS_PARCEL";
      confidence = 0.94;
    }
  }

  if (!polygon) {
    throw new Error(
      "No parcel geometry available. Run survey first, or ingest a GeoJSON polygon.",
    );
  }

  const draft = buildBoundaryFromPolygon(
    projectId,
    polygon,
    source,
    sourceKind,
    {
      aiConfidence: confidence,
      mapboxCenter:
        project.lat != null && project.lng != null
          ? { lat: project.lat, lng: project.lng }
          : undefined,
      lastModifiedBy: ownerId,
    },
  );

  const boundary = await store.upsertSiteBoundary(
    ownerId,
    projectId,
    toUpsert(draft),
  );

  const origin = boundary.geo_reference.canvas_origin_geo;
  const titleRing = (polygon.coordinates[0] ?? []).map(
    ([lng, lat]) => [lng, lat] as [number, number],
  );

  let housePoly: GeoJsonPolygon | null = null;
  if (
    survey?.house_polygon?.coordinates?.[0] &&
    survey.house_polygon.coordinates[0].length >= 4 &&
    survey.house_area_m2 > 0
  ) {
    housePoly = survey.house_polygon;
  } else if (titleRing.length >= 4) {
    try {
      housePoly = await fetchBuildingPolygon(titleRing);
    } catch (err) {
      console.warn("[boundary] Vicmap building fetch failed:", err);
    }
  }

  const building_canvas = housePoly
    ? geoJsonPolygonToCanvasMetres(housePoly, origin)
    : [];
  const building_source =
    building_canvas.length >= 3 ? ("vicmap" as const) : null;

  let easement_lines_canvas: BoundaryAutoTraceResponse["easement_lines_canvas"] =
    [];
  let easement_source: BoundaryAutoTraceResponse["easement_source"] = null;
  if (titleRing.length >= 4) {
    try {
      const lines = await fetchEasementLinesForTitle(titleRing);
      easement_lines_canvas = lines.flatMap((line) => {
        const projected = geoJsonLineToCanvasMetres(
          { type: "LineString", coordinates: line.coordinates },
          origin,
        );
        return projected.map((points) => ({
          points,
          pfi: line.pfi,
          status: line.status,
        }));
      });
      if (easement_lines_canvas.length > 0) easement_source = "vicmap";
    } catch (err) {
      console.warn("[boundary] Vicmap easement fetch failed:", err);
    }
  }

  return {
    boundary,
    building_canvas,
    building_source,
    easement_lines_canvas,
    easement_source,
  };
}

export async function ingestBoundaryGeoJson(
  store: Store,
  ownerId: string,
  projectId: string,
  polygon: GeoJsonPolygon,
  sourceKind: "vicmap" | "geojson_ingest" = "geojson_ingest",
  aiConfidence: number | null = null,
): Promise<SiteBoundary> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const draft = buildBoundaryFromPolygon(
    projectId,
    polygon,
    sourceKind === "vicmap" ? "GIS_PARCEL" : "AI_GENERATED",
    sourceKind,
    {
      aiConfidence,
      mapboxCenter:
        project.lat != null && project.lng != null
          ? { lat: project.lat, lng: project.lng }
          : undefined,
      lastModifiedBy: ownerId,
    },
  );
  return store.upsertSiteBoundary(ownerId, projectId, toUpsert(draft));
}

export async function lockSiteBoundaryDoc(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<SiteBoundary> {
  const existing = await store.getSiteBoundary(ownerId, projectId);
  if (!existing) throw new Error("No site boundary to lock");
  const locked = lockBoundary(existing, ownerId);
  return store.upsertSiteBoundary(ownerId, projectId, toUpsert(locked));
}

export async function unlockSiteBoundaryDoc(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<SiteBoundary> {
  const existing = await store.getSiteBoundary(ownerId, projectId);
  if (!existing) throw new Error("No site boundary to unlock");
  const unlocked = unlockBoundary(existing);
  return store.upsertSiteBoundary(ownerId, projectId, toUpsert(unlocked));
}

export async function resetSiteBoundaryDoc(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<boolean> {
  return store.deleteSiteBoundary(ownerId, projectId);
}

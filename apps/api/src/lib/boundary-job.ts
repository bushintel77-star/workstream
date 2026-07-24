import type { Store } from "@workstream/db";
import type {
  GeoJsonPolygon,
  SiteBoundary,
  SiteEasement,
  UpsertSiteBoundaryInput,
} from "@workstream/contracts";
import {
  buildBoundaryFromPolygon,
  geoToCanvasMetres,
  lockBoundary,
  unlockBoundary,
} from "@workstream/domain";
import { fetchEasementPolylines, fetchTitlePolygon } from "./vicmap";

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

export type AutoTraceBoundaryResult = {
  boundary: SiteBoundary;
  /** Indicative Vicmap easements in the boundary's canvas-metre frame. */
  easements: SiteEasement[];
};

/** Auto-trace: keyless Vicmap WFS parcel, else survey title_polygon. */
export async function autoTraceSiteBoundary(
  store: Store,
  ownerId: string,
  projectId: string,
  preferGis = true,
): Promise<AutoTraceBoundaryResult> {
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

  if (!polygon) {
    const survey = await store.getSurvey(ownerId, projectId);
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

  // Indicative easements — best-effort, never fail the trace over them.
  let easements: SiteEasement[] = [];
  const titleRing = polygon.coordinates[0];
  if (titleRing && titleRing.length >= 4) {
    try {
      const origin = boundary.geo_reference.canvas_origin_geo;
      const lines = await fetchEasementPolylines(
        titleRing as Array<[number, number]>,
      );
      easements = lines
        .filter((e) => e.line.length >= 2)
        .map((e) => ({
          points: e.line.map(([lng, lat]) =>
            geoToCanvasMetres({ lng, lat }, origin),
          ),
          status: e.status,
          source: "vicmap" as const,
        }));
    } catch (err) {
      console.warn("[boundary] Vicmap easement trace failed:", err);
    }
  }

  return { boundary, easements };
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

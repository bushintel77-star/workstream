import type { Store } from "@workstream/db";
import type {
  GeoJsonPolygon,
  SiteBoundary,
  UpsertSiteBoundaryInput,
} from "@workstream/contracts";
import {
  buildBoundaryFromPolygon,
  lockBoundary,
  unlockBoundary,
} from "@workstream/domain";
import {
  fetchTitlePolygon,
  isVicmapEnabled,
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

/** Auto-trace: Vicmap parcel when enabled, else survey title_polygon. */
export async function autoTraceSiteBoundary(
  store: Store,
  ownerId: string,
  projectId: string,
  preferGis = true,
): Promise<SiteBoundary> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  let polygon: GeoJsonPolygon | null = null;
  let sourceKind: SiteBoundary["source_kind"] = "ai_trace";
  let source: "GIS_PARCEL" | "AI_GENERATED" = "AI_GENERATED";
  let confidence: number | null = 0.84;

  if (preferGis && isVicmapEnabled() && project.lat != null && project.lng != null) {
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
      // Survey rings from Vicmap survey job are municipal; mock rings are AI-ish.
      if (isVicmapEnabled()) {
        sourceKind = "vicmap";
        source = "GIS_PARCEL";
        confidence = 0.94;
      } else {
        sourceKind = "ai_trace";
        source = "AI_GENERATED";
        confidence = 0.72;
      }
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

  return store.upsertSiteBoundary(ownerId, projectId, toUpsert(draft));
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

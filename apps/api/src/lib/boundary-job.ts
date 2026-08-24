import type { Store } from "@workstream/db";
import type {
  BoundaryAutoTraceResponse,
  GeoJsonPolygon,
  SiteBoundary,
  SiteEasement,
  UpsertSiteBoundaryInput,
} from "@workstream/contracts";
import {
  buildBoundaryFromPolygon,
  geoJsonLineToCanvasMetres,
  geoJsonPolygonToCanvasMetres,
  geoToCanvasMetres,
  lockBoundary,
  unlockBoundary,
} from "@workstream/domain";
import {
  fetchBuildingPolygon,
  fetchEasementLinesForTitle,
  fetchNeighbourBuildingPolygons,
  fetchTitlePolygon,
  fetchUrbanTreePointsForTitle,
} from "./vicmap";
import { searchTitleParcelByAddress } from "./vicmap-title-search";

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

  if (preferGis) {
    // Title-search resolution first: address → property keys → parcel, the
    // way a conveyancer looks it up. Only when the address does not resolve
    // keyed (rural RMB, brand-new subdivision, service hiccup) do we gamble
    // on the geocoded pin's containment.
    if (project.address) {
      try {
        const keyed = await searchTitleParcelByAddress(project.address);
        if (keyed) {
          polygon = keyed.polygon;
          sourceKind = "vicmap";
          source = "GIS_PARCEL";
          confidence = 0.98;
        }
      } catch (err) {
        console.warn("[boundary] keyed title search failed:", err);
      }
    }
    if (!polygon && project.lat != null && project.lng != null) {
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
  let urban_trees_canvas: BoundaryAutoTraceResponse["urban_trees_canvas"] = [];
  let urban_trees_source: BoundaryAutoTraceResponse["urban_trees_source"] =
    null;
  let neighbour_buildings_canvas: BoundaryAutoTraceResponse["neighbour_buildings_canvas"] =
    [];
  let neighbour_buildings_source: BoundaryAutoTraceResponse["neighbour_buildings_source"] =
    null;
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
    try {
      const trees = await fetchUrbanTreePointsForTitle(titleRing);
      urban_trees_canvas = trees.map((t) => {
        const pt = geoToCanvasMetres({ lng: t.lng, lat: t.lat }, origin);
        return {
          x: pt.x,
          y: pt.y,
          canopy_radius_m: t.canopyRadiusM,
          height_m: t.heightM,
          label: t.label,
        };
      });
      if (urban_trees_canvas.length > 0) urban_trees_source = "vicmap";
    } catch (err) {
      console.warn("[boundary] Vicmap urban tree fetch failed:", err);
    }
    try {
      const neighbours = await fetchNeighbourBuildingPolygons(titleRing);
      neighbour_buildings_canvas = neighbours
        .map((n) => ({
          ring: geoJsonPolygonToCanvasMetres(n.polygon, origin),
          height_m: n.heightM,
        }))
        .filter((n) => n.ring.length >= 3);
      if (neighbour_buildings_canvas.length > 0) {
        neighbour_buildings_source = "vicmap";
      }
    } catch (err) {
      console.warn("[boundary] Vicmap neighbour fetch failed:", err);
    }
  }

  return {
    boundary,
    building_canvas,
    building_source,
    easement_lines_canvas,
    easement_source,
    urban_trees_canvas,
    urban_trees_source,
    neighbour_buildings_canvas,
    neighbour_buildings_source,
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

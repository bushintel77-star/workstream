import type {
  BoundaryMetrics,
  BoundaryStatus,
  BoundaryVertex,
  BoundaryVertexSource,
  GeoCoords,
  GeoJsonPolygon,
  SiteBoundary,
} from "@workstream/contracts";
import { polygonArea, polygonPerimeter, type LngLat } from "./geometry";

const METERS_PER_DEG_LAT = 110_540;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function openRing(ring: LngLat[]): LngLat[] {
  if (ring.length < 2) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

function ringBbox(ring: LngLat[]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLng, minLat, maxLng, maxLat };
}

export function computeBoundaryMetrics(
  vertices: BoundaryVertex[],
  aiConfidence: number | null = null,
): BoundaryMetrics {
  const ring = vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((v) => [v.geo_coords.lng, v.geo_coords.lat] as LngLat);
  return {
    total_area_m2: Math.round(polygonArea(ring) * 100) / 100,
    perimeter_m: Math.round(polygonPerimeter(ring) * 100) / 100,
    ai_confidence: aiConfidence,
  };
}

export function geoToCanvasMetres(
  geo: GeoCoords,
  origin: GeoCoords,
): { x: number; y: number } {
  const mPerLng = metersPerDegLng(origin.lat);
  return {
    x: (geo.lng - origin.lng) * mPerLng,
    y: (geo.lat - origin.lat) * METERS_PER_DEG_LAT,
  };
}

export function canvasMetresToGeo(
  canvas: { x: number; y: number },
  origin: GeoCoords,
): GeoCoords {
  const mPerLng = metersPerDegLng(origin.lat);
  return {
    lng: origin.lng + canvas.x / mPerLng,
    lat: origin.lat + canvas.y / METERS_PER_DEG_LAT,
  };
}

export type BuildBoundaryFromRingOpts = {
  projectId: string;
  ring: LngLat[];
  source: BoundaryVertexSource;
  sourceKind: SiteBoundary["source_kind"];
  status?: BoundaryStatus;
  aiConfidence?: number | null;
  lastModifiedBy?: string | null;
  mapboxCenter?: GeoCoords;
};

/** Build a draft/verified boundary from a GeoJSON ring (EPSG:4326). */
export function buildBoundaryFromGeoRing(
  opts: BuildBoundaryFromRingOpts,
): Omit<SiteBoundary, "id" | "updated_at"> {
  const ring = openRing(opts.ring);
  if (ring.length < 3) {
    throw new Error("Boundary ring needs at least 3 vertices");
  }

  const box = ringBbox(ring);
  const pad = 2; // metres padding around parcel
  const mPerLng = metersPerDegLng(box.minLat);
  const origin: GeoCoords = {
    lng: box.minLng - pad / mPerLng,
    lat: box.minLat - pad / METERS_PER_DEG_LAT,
  };
  const width_m =
    Math.max(1, (box.maxLng - box.minLng) * mPerLng) + pad * 2;
  const height_m =
    Math.max(1, (box.maxLat - box.minLat) * METERS_PER_DEG_LAT) + pad * 2;

  const vertices: BoundaryVertex[] = ring.map((coord, i) => {
    const geo = { lng: coord[0], lat: coord[1] };
    return {
      vertex_id: `v_${String(i + 1).padStart(3, "0")}`,
      sequence_index: i,
      source: opts.source,
      is_locked: opts.status === "VERIFIED",
      canvas_coords: geoToCanvasMetres(geo, origin),
      geo_coords: geo,
    };
  });

  const status = opts.status ?? "UNVERIFIED";
  return {
    project_id: opts.projectId,
    layer_id: "layer_baseline_boundary",
    status,
    last_modified_by: opts.lastModifiedBy ?? null,
    source_kind: opts.sourceKind,
    geo_reference: {
      crs: "EPSG:4326",
      canvas_origin_geo: origin,
      metres_per_canvas_unit: 1,
      mapbox_center: opts.mapboxCenter,
    },
    width_m: Math.round(width_m * 100) / 100,
    height_m: Math.round(height_m * 100) / 100,
    calculated_metrics: computeBoundaryMetrics(
      vertices,
      opts.aiConfidence ?? (opts.sourceKind === "ai_trace" ? 0.84 : null),
    ),
    vertices,
  };
}

export function buildBoundaryFromPolygon(
  projectId: string,
  polygon: GeoJsonPolygon,
  source: BoundaryVertexSource,
  sourceKind: SiteBoundary["source_kind"],
  extras?: Partial<BuildBoundaryFromRingOpts>,
): Omit<SiteBoundary, "id" | "updated_at"> {
  const ring = polygon.coordinates[0];
  if (!ring) throw new Error("Polygon has no exterior ring");
  return buildBoundaryFromGeoRing({
    projectId,
    ring: ring as LngLat[],
    source,
    sourceKind,
    ...extras,
  });
}

/** Move a vertex in canvas metres; syncs geo; marks HUMAN_EDITED. */
export function moveBoundaryVertex(
  boundary: SiteBoundary,
  vertexId: string,
  canvas: { x: number; y: number },
  snapTargets: Array<{ x: number; y: number }> = [],
  snapToleranceM = 0.35,
): SiteBoundary {
  if (boundary.status === "VERIFIED") {
    throw new Error("Boundary is locked (VERIFIED); unlock before editing");
  }
  let next = { ...canvas };
  for (const t of snapTargets) {
    if (Math.hypot(t.x - next.x, t.y - next.y) <= snapToleranceM) {
      next = { x: t.x, y: t.y };
      break;
    }
  }
  // Orthogonal snap relative to previous vertex
  const verts = boundary.vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index);
  const idx = verts.findIndex((v) => v.vertex_id === vertexId);
  if (idx < 0) throw new Error(`Unknown vertex ${vertexId}`);
  const prev = verts[(idx - 1 + verts.length) % verts.length]!;
  const dx = Math.abs(next.x - prev.canvas_coords.x);
  const dy = Math.abs(next.y - prev.canvas_coords.y);
  if (dx < 0.25) next = { x: prev.canvas_coords.x, y: next.y };
  else if (dy < 0.25) next = { x: next.x, y: prev.canvas_coords.y };

  const origin = boundary.geo_reference.canvas_origin_geo;
  const vertices = boundary.vertices.map((v) => {
    if (v.vertex_id !== vertexId) return v;
    return {
      ...v,
      source:
        v.source === "HUMAN_ADDED"
          ? ("HUMAN_ADDED" as const)
          : ("HUMAN_EDITED" as const),
      canvas_coords: next,
      geo_coords: canvasMetresToGeo(next, origin),
      is_locked: false,
    };
  });
  return {
    ...boundary,
    status: "UNVERIFIED",
    vertices,
    calculated_metrics: computeBoundaryMetrics(
      vertices,
      boundary.calculated_metrics.ai_confidence,
    ),
  };
}

/** Insert a vertex on the segment after `afterVertexId`. */
export function insertBoundaryVertex(
  boundary: SiteBoundary,
  afterVertexId: string,
  canvas: { x: number; y: number },
): SiteBoundary {
  if (boundary.status === "VERIFIED") {
    throw new Error("Boundary is locked (VERIFIED); unlock before editing");
  }
  const sorted = boundary.vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index);
  const idx = sorted.findIndex((v) => v.vertex_id === afterVertexId);
  if (idx < 0) throw new Error(`Unknown vertex ${afterVertexId}`);
  const origin = boundary.geo_reference.canvas_origin_geo;
  const neo: BoundaryVertex = {
    vertex_id: `v_${crypto.randomUUID().slice(0, 8)}`,
    sequence_index: idx + 1,
    source: "HUMAN_ADDED",
    is_locked: false,
    canvas_coords: canvas,
    geo_coords: canvasMetresToGeo(canvas, origin),
  };
  const next = [
    ...sorted.slice(0, idx + 1),
    neo,
    ...sorted.slice(idx + 1),
  ].map((v, i) => ({ ...v, sequence_index: i }));
  return {
    ...boundary,
    status: "UNVERIFIED",
    vertices: next,
    calculated_metrics: computeBoundaryMetrics(
      next,
      boundary.calculated_metrics.ai_confidence,
    ),
  };
}

export function deleteBoundaryVertex(
  boundary: SiteBoundary,
  vertexId: string,
): SiteBoundary {
  if (boundary.status === "VERIFIED") {
    throw new Error("Boundary is locked (VERIFIED); unlock before editing");
  }
  const sorted = boundary.vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .filter((v) => v.vertex_id !== vertexId);
  if (sorted.length < 3) {
    throw new Error("Boundary must keep at least 3 vertices");
  }
  const next = sorted.map((v, i) => ({ ...v, sequence_index: i }));
  return {
    ...boundary,
    status: "UNVERIFIED",
    vertices: next,
    calculated_metrics: computeBoundaryMetrics(
      next,
      boundary.calculated_metrics.ai_confidence,
    ),
  };
}

/** Lock boundary: freeze vertices as read-only baseline. */
export function lockBoundary(
  boundary: SiteBoundary,
  userId: string | null = null,
): SiteBoundary {
  const vertices = boundary.vertices.map((v) => ({
    ...v,
    is_locked: true,
  }));
  return {
    ...boundary,
    status: "VERIFIED",
    last_modified_by: userId,
    vertices,
    calculated_metrics: {
      ...computeBoundaryMetrics(vertices, null),
      ai_confidence: null,
    },
  };
}

export function unlockBoundary(boundary: SiteBoundary): SiteBoundary {
  const vertices = boundary.vertices.map((v) => ({
    ...v,
    is_locked: false,
  }));
  return {
    ...boundary,
    status: "UNVERIFIED",
    vertices,
    calculated_metrics: computeBoundaryMetrics(
      vertices,
      boundary.calculated_metrics.ai_confidence,
    ),
  };
}

/** Snap targets from GIS parcel ring projected into canvas metres. */
export function gisSnapTargets(
  parcelRing: LngLat[],
  origin: GeoCoords,
): Array<{ x: number; y: number }> {
  return openRing(parcelRing).map(([lng, lat]) =>
    geoToCanvasMetres({ lng, lat }, origin),
  );
}

export function boundaryToGeoJsonPolygon(
  boundary: SiteBoundary,
): GeoJsonPolygon {
  const ring = boundary.vertices
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((v) => [v.geo_coords.lng, v.geo_coords.lat] as LngLat);
  const closed =
    ring.length > 0
      ? [...ring, ring[0]!]
      : ring;
  return { type: "Polygon", coordinates: [closed] };
}

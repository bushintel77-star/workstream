import type { Store } from "@workstream/db";
import type { GeoCoords } from "@workstream/contracts";
import { geoJsonLineToCanvasMetres } from "@workstream/domain";

type LngLat = [number, number];

type RawGeom =
  | { type: "LineString"; coordinates: LngLat[] }
  | { type: "MultiLineString"; coordinates: LngLat[][] }
  | { type: "Feature"; geometry: RawGeom | null; properties?: unknown }
  | { type: "FeatureCollection"; features: Array<{ geometry?: RawGeom | null }> };

function collectLineGeoms(input: unknown): Array<{
  type: "LineString" | "MultiLineString";
  coordinates: LngLat[] | LngLat[][];
}> {
  if (!input || typeof input !== "object") return [];
  const g = input as RawGeom;
  if (g.type === "LineString" || g.type === "MultiLineString") {
    return [g as { type: "LineString" | "MultiLineString"; coordinates: LngLat[] | LngLat[][] }];
  }
  if (g.type === "Feature" && g.geometry) {
    return collectLineGeoms(g.geometry);
  }
  if (g.type === "FeatureCollection" && Array.isArray(g.features)) {
    return g.features.flatMap((f) => collectLineGeoms(f.geometry ?? f));
  }
  return [];
}

/**
 * Project council drainage / stormwater GeoJSON (WGS84 lines) into the
 * site boundary canvas-metre frame for BYDA-style digitise (`source: traced`).
 */
export async function ingestStormwaterGeoJson(
  store: Store,
  ownerId: string,
  projectId: string,
  geojson: unknown,
): Promise<{
  lines_canvas: Array<{ points: Array<{ x: number; y: number }> }>;
  source: "traced";
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const boundary = await store.getSiteBoundary(ownerId, projectId);
  const origin: GeoCoords = boundary?.geo_reference.canvas_origin_geo ?? {
    lng: project.lng ?? 144.993,
    lat: project.lat ?? -37.849,
  };

  const lines_canvas: Array<{ points: Array<{ x: number; y: number }> }> = [];
  for (const geom of collectLineGeoms(geojson)) {
    const projected = geoJsonLineToCanvasMetres(
      geom.type === "LineString"
        ? { type: "LineString", coordinates: geom.coordinates as LngLat[] }
        : {
            type: "MultiLineString",
            coordinates: geom.coordinates as LngLat[][],
          },
      origin,
    );
    for (const points of projected) {
      lines_canvas.push({ points });
      if (lines_canvas.length >= 40) {
        return { lines_canvas, source: "traced" };
      }
    }
  }
  return { lines_canvas, source: "traced" };
}

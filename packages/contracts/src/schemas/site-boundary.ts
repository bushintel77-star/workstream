import { z } from "zod";
import {
  VerificationStateSchema,
  type VerificationState,
} from "./verification";

/** Lifecycle of a boundary vertex for HITL audit. */
export const BoundaryVertexSourceSchema = z.enum([
  "AI_GENERATED",
  "HUMAN_EDITED",
  "HUMAN_ADDED",
  "GIS_PARCEL",
]);
export type BoundaryVertexSource = z.infer<typeof BoundaryVertexSourceSchema>;

/** Alias of VerificationState — boundary HITL status. */
export const BoundaryStatusSchema = VerificationStateSchema;
export type BoundaryStatus = VerificationState;

export const GeoCoordsSchema = z.object({
  lng: z.number(),
  lat: z.number(),
});
export type GeoCoords = z.infer<typeof GeoCoordsSchema>;

/** Metre-space CAD canvas coords (document local, origin at lot SW). */
export const CanvasMetreCoordsSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type CanvasMetreCoords = z.infer<typeof CanvasMetreCoordsSchema>;

export const BoundaryVertexSchema = z.object({
  vertex_id: z.string().min(1),
  sequence_index: z.number().int().nonnegative(),
  source: BoundaryVertexSourceSchema,
  is_locked: z.boolean(),
  canvas_coords: CanvasMetreCoordsSchema,
  geo_coords: GeoCoordsSchema,
  is_master_reference: z.boolean().optional(),
});
export type BoundaryVertex = z.infer<typeof BoundaryVertexSchema>;

export const BoundaryMetricsSchema = z.object({
  total_area_m2: z.number().nonnegative(),
  perimeter_m: z.number().nonnegative(),
  ai_confidence: z.number().min(0).max(1).nullable(),
});
export type BoundaryMetrics = z.infer<typeof BoundaryMetricsSchema>;

export const GeoReferenceSchema = z.object({
  crs: z.literal("EPSG:4326"),
  /** Top-left / NW corner of the CAD canvas in geo space. */
  canvas_origin_geo: GeoCoordsSchema,
  /** Metres per CAD unit (always 1 for metre-space docs). */
  metres_per_canvas_unit: z.literal(1),
  mapbox_center: GeoCoordsSchema.optional(),
  mapbox_zoom: z.number().optional(),
  mapbox_bearing: z.number().optional(),
  mapbox_pitch: z.number().optional(),
});
export type GeoReference = z.infer<typeof GeoReferenceSchema>;

export const SiteBoundarySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  layer_id: z.string().min(1).default("layer_baseline_boundary"),
  status: BoundaryStatusSchema,
  last_modified_by: z.string().nullable(),
  source_kind: z.enum(["vicmap", "geojson_ingest", "ai_trace", "manual"]),
  geo_reference: GeoReferenceSchema,
  /** CAD document extents used when projecting vertices. */
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  calculated_metrics: BoundaryMetricsSchema,
  vertices: z.array(BoundaryVertexSchema).min(3),
  updated_at: z.string().datetime(),
});
export type SiteBoundary = z.infer<typeof SiteBoundarySchema>;

export const UpsertSiteBoundarySchema = SiteBoundarySchema.omit({
  id: true,
  updated_at: true,
}).partial({
  layer_id: true,
  last_modified_by: true,
  source_kind: true,
}).extend({
  project_id: z.string().uuid(),
  status: BoundaryStatusSchema,
  geo_reference: GeoReferenceSchema,
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  calculated_metrics: BoundaryMetricsSchema,
  vertices: z.array(BoundaryVertexSchema).min(3),
});
export type UpsertSiteBoundaryInput = z.infer<typeof UpsertSiteBoundarySchema>;

export const IngestBoundaryGeoJsonSchema = z.object({
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
  source_kind: z.enum(["vicmap", "geojson_ingest"]).default("geojson_ingest"),
  ai_confidence: z.number().min(0).max(1).nullable().optional(),
});
export type IngestBoundaryGeoJsonInput = z.infer<
  typeof IngestBoundaryGeoJsonSchema
>;

/**
 * Indicative easement polyline auto-traced from Vicmap WFS.
 * Points are canvas metres sharing the boundary's canvas_origin_geo, so a
 * client that projects boundary vertices can project these with the same
 * transform. Ephemeral — returned alongside auto-trace, never persisted.
 */
export const SiteEasementSchema = z.object({
  points: z.array(CanvasMetreCoordsSchema).min(2),
  status: z.string().nullable(),
  source: z.literal("vicmap"),
});
export type SiteEasement = z.infer<typeof SiteEasementSchema>;

export const BoundaryAutoTraceRequestSchema = z.object({
  /** Prefer municipal GIS (Vicmap) when available; else survey title ring. */
  prefer_gis: z.boolean().default(true),
});
export type BoundaryAutoTraceRequest = z.infer<
  typeof BoundaryAutoTraceRequestSchema
>;

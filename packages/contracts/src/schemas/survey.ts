import { z } from "zod";

export const GeoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygonSchema>;

export const MeasurementSchema = z.object({
  edge_id: z.string(),
  length_m: z.number().positive(),
  bearing_deg: z.number().min(0).max(360),
  label: z.string().optional(),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

export const SurveySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  aerial_uri: z.string().url(),
  title_polygon: GeoJsonPolygonSchema,
  house_polygon: GeoJsonPolygonSchema,
  garden_polygon: GeoJsonPolygonSchema,
  lot_area_m2: z.number().positive(),
  house_area_m2: z.number().positive(),
  garden_area_m2: z.number().positive(),
  measurements: z.array(MeasurementSchema),
});
export type Survey = z.infer<typeof SurveySchema>;

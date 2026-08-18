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

/** An on-site photo in the survey's photo gallery (photo-trace elevation source). */
export const SitePhotoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  uri: z.string().url(),
  /** Natural aspect (width / height) — measured client-side at upload. */
  natural_aspect: z.number().positive(),
  created_at: z.string().datetime(),
});
export type SitePhoto = z.infer<typeof SitePhotoSchema>;

export const SurveySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  aerial_uri: z.string().url(),
  title_polygon: GeoJsonPolygonSchema,
  house_polygon: GeoJsonPolygonSchema,
  garden_polygon: GeoJsonPolygonSchema,
  /** Zero means title area unknown — never invent a seed lot. */
  lot_area_m2: z.number().nonnegative(),
  /** Zero means the existing-house outline is unavailable — never fabricate it. */
  house_area_m2: z.number().nonnegative(),
  /** Zero means outdoor / garden area unknown — Trace the title on the aerial. */
  garden_area_m2: z.number().nonnegative(),
  measurements: z.array(MeasurementSchema),
  /** On-site photos captured by the operator (gallery for photo-trace elevation).
   *  Optional — surveys created before the gallery landed have no photos. */
  site_photos: z.array(SitePhotoSchema).optional(),
});
export type Survey = z.infer<typeof SurveySchema>;

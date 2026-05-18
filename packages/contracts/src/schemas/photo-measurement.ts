import { z } from "zod";

export const PhotoMeasurementUnitSchema = z.enum([
  "meters",
  "centimeters",
  "millimeters",
  "square_meters",
  "cubic_meters",
  "unknown",
]);
export type PhotoMeasurementUnit = z.infer<typeof PhotoMeasurementUnitSchema>;

export const PhotoMeasurementItemSchema = z.object({
  description: z.string(),
  value: z.number().nonnegative(),
  unit: PhotoMeasurementUnitSchema,
  confidence: z.number().min(0).max(1),
  reference_used: z.string().nullable(),
});
export type PhotoMeasurementItem = z.infer<typeof PhotoMeasurementItemSchema>;

export const PhotoMeasurementSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  image_uri: z.string().url(),
  items: z.array(PhotoMeasurementItemSchema),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type PhotoMeasurement = z.infer<typeof PhotoMeasurementSchema>;

import { z } from "zod";

/**
 * IoT / twin telemetry for the live digital twin path (strategy §10).
 *
 * Readings are measured samples from site sensors (or honestly labelled demo
 * seeds). They are not modelled sustainability metrics — those stay in
 * `BoardSustainability`. Phase 4 ships ingest + canvas overlay; Phase 5 adds
 * performance alerts on top of this stream.
 */

export const TelemetryKindSchema = z.enum([
  "soil_moisture",
  "thermal_comfort",
  "flow",
  "sediment",
]);
export type TelemetryKind = z.infer<typeof TelemetryKindSchema>;

export const TelemetrySourceSchema = z.enum(["sensor", "demo", "manual"]);
export type TelemetrySource = z.infer<typeof TelemetrySourceSchema>;

/** Canonical units per kind — ingest must match. */
export const TELEMETRY_UNITS = {
  soil_moisture: "%",
  thermal_comfort: "°C",
  flow: "L/min",
  sediment: "NTU",
} as const satisfies Record<TelemetryKind, string>;

export const TelemetryReadingSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  kind: TelemetryKindSchema,
  value: z.number().finite(),
  unit: z.string().min(1).max(16),
  /** Board % coords when the sensor is placed on the plan. */
  x_pct: z.number().min(0).max(100).nullable(),
  y_pct: z.number().min(0).max(100).nullable(),
  sensor_id: z.string().min(1).max(64).nullable(),
  label: z.string().min(1).max(120).nullable(),
  source: TelemetrySourceSchema,
  /** When the sample was taken on site (ISO). */
  observed_at: z.string().datetime(),
  created_at: z.string().datetime(),
});
export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;

export const IngestTelemetryReadingSchema = z.object({
  kind: TelemetryKindSchema,
  value: z.number().finite(),
  unit: z.string().min(1).max(16).optional(),
  x_pct: z.number().min(0).max(100).nullable().optional(),
  y_pct: z.number().min(0).max(100).nullable().optional(),
  sensor_id: z.string().min(1).max(64).nullable().optional(),
  label: z.string().min(1).max(120).nullable().optional(),
  source: TelemetrySourceSchema.optional(),
  observed_at: z.string().datetime().optional(),
});
export type IngestTelemetryReading = z.infer<typeof IngestTelemetryReadingSchema>;

export const IngestTelemetryRequestSchema = z.object({
  readings: z.array(IngestTelemetryReadingSchema).min(1).max(100),
});
export type IngestTelemetryRequest = z.infer<typeof IngestTelemetryRequestSchema>;

export const TelemetryLatestSchema = z.object({
  kind: TelemetryKindSchema,
  value: z.number().finite(),
  unit: z.string(),
  observed_at: z.string().datetime(),
  sensor_id: z.string().nullable(),
  label: z.string().nullable(),
  x_pct: z.number().nullable(),
  y_pct: z.number().nullable(),
  source: TelemetrySourceSchema,
  reading_id: z.string().uuid(),
});
export type TelemetryLatest = z.infer<typeof TelemetryLatestSchema>;

export const DesignTelemetryResponseSchema = z.object({
  readings: z.array(TelemetryReadingSchema),
  latest: z.array(TelemetryLatestSchema),
  count: z.number().int().nonnegative(),
});
export type DesignTelemetryResponse = z.infer<
  typeof DesignTelemetryResponseSchema
>;

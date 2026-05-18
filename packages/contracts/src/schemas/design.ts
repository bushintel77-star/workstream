import { z } from "zod";

export const DesignModeSchema = z.enum(["auto", "gapfill", "validate"]);
export type DesignMode = z.infer<typeof DesignModeSchema>;

export const GapFlagSchema = z.object({
  zone: z.string(),
  description: z.string(),
  proposed_fill: z.string(),
  rationale: z.string(),
});
export type GapFlag = z.infer<typeof GapFlagSchema>;

export const ZonePlantingSchema = z.object({
  species: z.string(),
  common_name: z.string(),
  count: z.number().int().nonnegative(),
  form: z.string(),
  sku: z.string().optional(),
});
export type ZonePlanting = z.infer<typeof ZonePlantingSchema>;

export const ZoneHardscapeSchema = z.object({
  item: z.string(),
  qty: z.number().nonnegative(),
  unit: z.string(),
  sku: z.string().optional(),
});
export type ZoneHardscape = z.infer<typeof ZoneHardscapeSchema>;

export const ZoneLightingSchema = z.object({
  fixture: z.string(),
  count: z.number().int().nonnegative(),
  sku: z.string().optional(),
});
export type ZoneLighting = z.infer<typeof ZoneLightingSchema>;

export const ZoneIrrigationSchema = z.object({
  item: z.string(),
  qty: z.number().nonnegative(),
  unit: z.string(),
  sku: z.string().optional(),
});
export type ZoneIrrigation = z.infer<typeof ZoneIrrigationSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  treatment: z.string(),
  plantings: z.array(ZonePlantingSchema).default([]),
  hardscape: z.array(ZoneHardscapeSchema).default([]),
  lighting: z.array(ZoneLightingSchema).default([]),
  irrigation: z.array(ZoneIrrigationSchema).default([]),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const DesignProposalSchema = z.object({
  zones: z.array(ZoneSchema),
  estimated_complexity: z.enum(["simple", "standard", "complex"]),
});
export type DesignProposal = z.infer<typeof DesignProposalSchema>;

export const DesignSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  mode: DesignModeSchema,
  proposal: DesignProposalSchema,
  gaps: z.array(GapFlagSchema),
  rationale: z.string(),
  version: z.number().int().positive(),
});
export type Design = z.infer<typeof DesignSchema>;

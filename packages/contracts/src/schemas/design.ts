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

/**
 * One irrigation BOM line inside a design zone — an item/qty/unit row, the
 * sibling of `ZonePlantingSchema` / `ZoneHardscapeSchema` / `ZoneLightingSchema`.
 *
 * The `...Line` suffix is load-bearing: the catalog's `IrrigationZoneSchema`
 * is a different concept entirely (an authored path on the studio canvas with
 * emitters and hydraulics). Without the suffix the two names are permutations
 * of each other, which makes picking the wrong one at a call site a coin flip
 * the type system cannot catch.
 */
export const ZoneIrrigationLineSchema = z.object({
  item: z.string(),
  qty: z.number().nonnegative(),
  unit: z.string(),
  sku: z.string().optional(),
});
export type ZoneIrrigationLine = z.infer<typeof ZoneIrrigationLineSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  treatment: z.string(),
  plantings: z.array(ZonePlantingSchema).default([]),
  hardscape: z.array(ZoneHardscapeSchema).default([]),
  lighting: z.array(ZoneLightingSchema).default([]),
  irrigation: z.array(ZoneIrrigationLineSchema).default([]),
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

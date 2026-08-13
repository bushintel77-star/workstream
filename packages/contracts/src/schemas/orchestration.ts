import { z } from "zod";

/** Layer family for material orchestration. */
export const SpatialLayerSchema = z.enum([
  "hardscape",
  "softscape",
  "irrigation",
  "lighting",
  "topography",
  "structure",
  "other",
]);
export type SpatialLayer = z.infer<typeof SpatialLayerSchema>;

export const SpatialObjectSchema = z.object({
  id: z.string(),
  layer: SpatialLayerSchema,
  label: z.string(),
  symbol_id: z.string().optional(),
  source: z.enum(["placement", "cad", "irrigation"]),
  area_m2: z.number().nonnegative().default(0),
  length_m: z.number().nonnegative().default(0),
  depth_m: z.number().nonnegative().optional(),
  height_m: z.number().nonnegative().optional(),
  volume_m3: z.number().nonnegative().optional(),
  count: z.number().int().positive().default(1),
  x_pct: z.number().min(0).max(100).optional(),
  y_pct: z.number().min(0).max(100).optional(),
  mature_canopy_m: z.number().nonnegative().optional(),
  root_radius_m: z.number().nonnegative().optional(),
  gpm: z.number().nonnegative().optional(),
  pressure_drop_kpa: z.number().nonnegative().optional(),
  site_origin_locked: z.boolean().default(true).optional(),
  origin_x: z.number().optional(),
  origin_y: z.number().optional(),
  origin_z: z.number().optional(),
  maturity_index: z.number().min(0).max(1).optional(),
  strike_alert: z.boolean().default(false).optional(),
});
export type SpatialObject = z.infer<typeof SpatialObjectSchema>;

export const BomTierSchema = z.enum([
  "primary",
  "secondary",
  "tertiary",
  "labour",
  "logistics",
  "fee",
]);
export type BomTier = z.infer<typeof BomTierSchema>;

export const BomLineSchema = z.object({
  id: z.string(),
  tier: BomTierSchema,
  sku: z.string().nullable(),
  label: z.string(),
  unit: z.string(),
  qty: z.number().nonnegative(),
  rate: z.number().nonnegative(),
  total: z.number().nonnegative(),
  source_object_ids: z.array(z.string()),
  notes: z.string().optional(),
  is_provisional: z.boolean().default(true),
});
export type BomLine = z.infer<typeof BomLineSchema>;

export const SiteMultipliersSchema = z.object({
  soil: z.enum(["standard", "clay", "sandy", "rock"]).default("standard"),
  slope: z.enum(["flat", "moderate", "steep"]).default("flat"),
  access: z.enum(["easy", "constrained", "crane"]).default("easy"),
  soil_factor: z.number().positive().default(1),
  slope_factor: z.number().positive().default(1),
  access_factor: z.number().positive().default(1),
});
export type SiteMultipliers = z.infer<typeof SiteMultipliersSchema>;

export const RiskSeveritySchema = z.enum(["info", "watch", "critical"]);
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

export const RiskFindingSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "retaining_height",
    "trp_conflict",
    "drainage",
    "utility",
    "access",
  ]),
  severity: RiskSeveritySchema,
  title: z.string(),
  detail: z.string(),
  source_object_ids: z.array(z.string()),
  overlay_id: z.string().optional(),
});
export type RiskFinding = z.infer<typeof RiskFindingSchema>;

export const OverlayProposalKindSchema = z.enum([
  "trp_ring",
  "drainage",
  "engineer_hold",
  "utility_hold",
]);
export type OverlayProposalKind = z.infer<typeof OverlayProposalKindSchema>;

export const OverlayProposalSchema = z.object({
  id: z.string(),
  kind: OverlayProposalKindSchema,
  status: z.enum(["ready", "accepted", "dismissed"]).default("ready"),
  title: z.string(),
  detail: z.string(),
  /** Suggested sketch placement when accepted. */
  suggest_symbol_id: z.string().optional(),
  x_pct: z.number().min(0).max(100).optional(),
  y_pct: z.number().min(0).max(100).optional(),
  /** Suggested ring radius in metres (TRP). */
  radius_m: z.number().positive().optional(),
  source_object_ids: z.array(z.string()),
  bom_line_ids: z.array(z.string()).default([]),
});
export type OverlayProposal = z.infer<typeof OverlayProposalSchema>;

export const ProjectOrchestrationWorldSchema = z.object({
  project_id: z.string().uuid(),
  fingerprint: z.string(),
  stale: z.boolean().default(false),
  running: z.boolean().default(false),
  updated_at: z.string().datetime(),
  multipliers: SiteMultipliersSchema,
  spatial_facts: z.array(SpatialObjectSchema),
  live_bom: z.array(BomLineSchema),
  bom_subtotal: z.number().nonnegative(),
  bom_gst: z.number().nonnegative(),
  bom_total: z.number().nonnegative(),
  risks: z.array(RiskFindingSchema),
  overlays: z.array(OverlayProposalSchema),
});
export type ProjectOrchestrationWorld = z.infer<
  typeof ProjectOrchestrationWorldSchema
>;

export const AcceptOverlayInputSchema = z.object({
  proposal_id: z.string().min(1),
});
export type AcceptOverlayInput = z.infer<typeof AcceptOverlayInputSchema>;

export const DismissOverlayInputSchema = z.object({
  proposal_id: z.string().min(1),
});
export type DismissOverlayInput = z.infer<typeof DismissOverlayInputSchema>;

/** Persisted accept/dismiss decisions for preemptive overlay proposals. */
export const OrchestrationOverlayRecordSchema = z.object({
  owner_id: z.string(),
  project_id: z.string().uuid(),
  dismissed_ids: z.array(z.string()).default([]),
  accepted_ids: z.array(z.string()).default([]),
  updated_at: z.string().datetime(),
});
export type OrchestrationOverlayRecord = z.infer<
  typeof OrchestrationOverlayRecordSchema
>;

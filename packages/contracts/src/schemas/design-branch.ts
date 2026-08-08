import { z } from "zod";
import {
  CanvasAnnotationSchema,
  CanvasStrokeSchema,
  CatalogPlacementSchema,
  IrrigationZoneSchema,
} from "./catalog";
import { LandscapeFeatureSchema } from "./landscape-feature";

/** Frozen canvas payload restored when a branch is activated. */
export const DesignBranchCanvasSnapshotSchema = z.object({
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema).default([]),
  irrigation_zones: z.array(IrrigationZoneSchema).default([]),
  annotations: z.array(CanvasAnnotationSchema).default([]),
  features: z.array(LandscapeFeatureSchema).default([]),
});
export type DesignBranchCanvasSnapshot = z.infer<
  typeof DesignBranchCanvasSnapshotSchema
>;

/** Frozen design/quote snapshot for lightweight variation branching (PDF §4.5). */
export const DesignBranchSnapshotSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  parent_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  bom_total: z.number().nonnegative().default(0),
  labour_hours: z.number().nonnegative().default(0),
  thumbnail_note: z.string().max(240).optional(),
  canvas_fingerprint: z.string().default(""),
  canvas: DesignBranchCanvasSnapshotSchema.optional(),
  is_frozen: z.boolean().default(true),
  active: z.boolean().default(false),
});
export type DesignBranchSnapshot = z.infer<typeof DesignBranchSnapshotSchema>;

export const FreezeDesignBranchInputSchema = z.object({
  name: z.string().min(1).max(120),
  bom_total: z.number().nonnegative().optional(),
  labour_hours: z.number().nonnegative().optional(),
  thumbnail_note: z.string().max(240).optional(),
  canvas_fingerprint: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  canvas: DesignBranchCanvasSnapshotSchema.optional(),
});
export type FreezeDesignBranchInput = z.infer<
  typeof FreezeDesignBranchInputSchema
>;

export const ActivateDesignBranchInputSchema = z.object({
  branch_id: z.string().uuid(),
});
export type ActivateDesignBranchInput = z.infer<
  typeof ActivateDesignBranchInputSchema
>;

export const ListDesignBranchesResponseSchema = z.object({
  branches: z.array(DesignBranchSnapshotSchema),
  active_id: z.string().uuid().nullable(),
});
export type ListDesignBranchesResponse = z.infer<
  typeof ListDesignBranchesResponseSchema
>;

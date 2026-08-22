import { z } from "zod";
import { BoardPctSchema, BoardPointPctSchema } from "./board-coords";

/** Who authored the geometry - AI regen must never overwrite human_locked. */
export const FeatureSourceAttributionSchema = z.enum([
  "ai_detected",
  "human_drawn",
  "human_locked",
]);
export type FeatureSourceAttribution = z.infer<
  typeof FeatureSourceAttributionSchema
>;

export const FeatureModificationStateSchema = z.enum([
  "draft",
  "human_locked",
  "accepted",
]);
export type FeatureModificationState = z.infer<
  typeof FeatureModificationStateSchema
>;

export const FeatureLayerSchema = z.enum([
  "softscape_beds",
  "hardscape",
  "irrigation",
  "structure",
  "other",
]);
export type FeatureLayer = z.infer<typeof FeatureLayerSchema>;

export const GeodeticPointSchema = z.object({
  lng: z.number(),
  lat: z.number(),
});
export type GeodeticPoint = z.infer<typeof GeodeticPointSchema>;

export const BezierControlSchema = z.object({
  handle_in: z.tuple([z.number(), z.number()]).optional(),
  handle_out: z.tuple([z.number(), z.number()]).optional(),
});

export const FeatureVertexSchema = z.object({
  id: z.string().min(1),
  pct: BoardPointPctSchema,
  geodetic: GeodeticPointSchema.optional(),
  bezier_control: BezierControlSchema.optional(),
});
export type FeatureVertex = z.infer<typeof FeatureVertexSchema>;

export const FeatureGeometrySchema = z.object({
  type: z.enum(["Polygon", "Point", "LineString"]),
  /** Project CRS hint - UI source of truth is pct. */
  spatial_reference: z.string().default("EPSG:3857"),
  canvas_origin_pct: BoardPointPctSchema.default({ x_pct: 0, y_pct: 0 }),
  points: z.array(FeatureVertexSchema).min(1),
});
export type FeatureGeometry = z.infer<typeof FeatureGeometrySchema>;

export const LiveMaterialCalculationsSchema = z.object({
  area_m2: z.number().nonnegative(),
  volume_m3: z.number().nonnegative(),
  cost_aud: z.number().nonnegative(),
});
export type LiveMaterialCalculations = z.infer<
  typeof LiveMaterialCalculationsSchema
>;

export const MaterialFillSchema = z.object({
  type: z.enum(["volumetric_surface", "surface", "none"]).default("volumetric_surface"),
  sku: z.string().min(1),
  depth_m: z.number().positive().default(0.075),
  waste_allocation_pct: z.number().min(0).max(100).default(10),
  live_calculations: LiveMaterialCalculationsSchema.optional(),
});
export type MaterialFill = z.infer<typeof MaterialFillSchema>;

export const ScatterInstanceSchema = z.object({
  instance_id: z.string().min(1),
  sku: z.string().min(1),
  symbol_id: z.string().optional(),
  x_pct: BoardPctSchema,
  y_pct: BoardPctSchema,
  rotation_deg: z.number().default(0),
  scale: z.number().positive().default(1),
  live_cost_aud: z.number().nonnegative().optional(),
});
export type ScatterInstance = z.infer<typeof ScatterInstanceSchema>;

export const ProceduralScatterSchema = z.object({
  brush_recipe_id: z.string().min(1),
  seed_value: z.number().int(),
  instances: z.array(ScatterInstanceSchema).default([]),
  live_totals: z
    .object({
      total_plant_count: z.number().int().nonnegative(),
      total_plant_cost_aud: z.number().nonnegative(),
    })
    .optional(),
});
export type ProceduralScatter = z.infer<typeof ProceduralScatterSchema>;

export const LaborProfileSchema = z.object({
  base_difficulty_tier: z
    .enum(["easy", "standard_soil", "constrained", "rock"])
    .default("standard_soil"),
  estimated_install_hours: z.number().nonnegative().default(0),
  calculated_labor_cost_aud: z.number().nonnegative().default(0),
});
export type LaborProfile = z.infer<typeof LaborProfileSchema>;

export const LandscapeFeatureSchema = z.object({
  id: z.string().min(1),
  type: z.literal("LandscapeFeature"),
  metadata: z.object({
    layer: FeatureLayerSchema,
    friendly_name: z.string().max(200).optional(),
    timestamp_created: z.string().datetime(),
    source_attribution: FeatureSourceAttributionSchema,
    user_modification_state: FeatureModificationStateSchema.default("draft"),
  }),
  geometry: FeatureGeometrySchema,
  material_fill: MaterialFillSchema.optional(),
  procedural_scatter_contents: ProceduralScatterSchema.optional(),
  labor_profile: LaborProfileSchema.optional(),
  /**
   * Pad height above existing grade (metres) for a Polygon region that has
   * been given an elevation. Mirrors `CanvasStroke.extrude_height_m`: height
   * is a PROPERTY of a region, set as an edit, never a second way to draw one
   * (docs/precision-drafting-tools-spec.md §8.1). A region carrying it is a
   * cut/fill pad — `cutFill.padStrokes()` is the single definition of "pad"
   * and reads both strokes and features. Optional / absent = flat region, so
   * no migration and no existing feature silently becomes earthworks.
   */
  extrude_height_m: z.number().positive().optional(),
});
export type LandscapeFeature = z.infer<typeof LandscapeFeatureSchema>;

/** Instrumental brush recipe - SKU rides with catalog symbol. */
export const BrushRecipeSchema = z.object({
  id: z.string().min(1),
  symbol_id: z.string().min(1),
  scale: z.number().positive().default(1),
  rotation_deg: z.number().default(0),
  label: z.string().optional(),
  copy_geometry: z.boolean().default(true),
  copy_material: z.boolean().default(true),
  copy_pricing: z.boolean().default(true),
});
export type BrushRecipe = z.infer<typeof BrushRecipeSchema>;

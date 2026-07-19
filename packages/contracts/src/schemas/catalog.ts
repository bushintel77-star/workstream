import { z } from "zod";
import { LandscapeFeatureSchema } from "./landscape-feature";

export const CatalogCategorySchema = z.enum([
  "planting",
  "paving",
  "structure",
  "water",
  "annotation",
  "furniture",
]);
export type CatalogCategory = z.infer<typeof CatalogCategorySchema>;

/** One layer in a multi-path CAD glyph (palette + canvas). */
export const CatalogGlyphLayerSchema = z.object({
  d: z.string(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  stroke_width: z.number().positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type CatalogGlyphLayer = z.infer<typeof CatalogGlyphLayerSchema>;

/** Rich visual asset for the design widget library. */
export const CatalogAssetSchema = z.object({
  view_box: z.string().default("0 0 48 48"),
  layers: z.array(CatalogGlyphLayerSchema).min(1),
  /** Palette card background (CSS color). */
  preview_bg: z.string().optional(),
  /** Accent for selection ring / map pin. */
  accent: z.string().optional(),
});
export type CatalogAsset = z.infer<typeof CatalogAssetSchema>;

export const PlantSunSchema = z.enum(["full", "partial", "shade"]);
export type PlantSun = z.infer<typeof PlantSunSchema>;

export const PlantWaterSchema = z.enum(["low", "moderate", "high"]);
export type PlantWater = z.infer<typeof PlantWaterSchema>;

/** CAD-style symbol from the Curtis library. */
export const CatalogSymbolSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: CatalogCategorySchema,
  /** Compact path for legacy renderers (map pin fallback). */
  path_d: z.string(),
  /** Full-colour glyph for palette cards and canvas. */
  asset: CatalogAssetSchema.optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  botanical_name: z.string().optional(),
  sun: PlantSunSchema.optional(),
  water: PlantWaterSchema.optional(),
  soil: z.string().optional(),
  mature_height_m: z.number().positive().optional(),
  default_width_m: z.number().positive().optional(),
  rate_card_sku: z.string().optional(),
});
export type CatalogSymbol = z.infer<typeof CatalogSymbolSchema>;

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  planting: "Planting",
  paving: "Hardscape",
  structure: "Structures",
  water: "Water",
  furniture: "Site furniture",
  annotation: "Markup",
};

export const CatalogPlacementSchema = z.object({
  id: z.string().uuid(),
  symbol_id: z.string(),
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  rotation_deg: z.number().min(0).max(360).default(0),
  scale: z.number().positive().default(1),
  label: z.string().optional(),
});
export type CatalogPlacement = z.infer<typeof CatalogPlacementSchema>;

/** Freehand stroke — populated when Apple Pencil / PencilKit lands (phase 2). */
export const CanvasStrokeSchema = z.object({
  id: z.string().uuid(),
  points: z.array(
    z.object({
      x_pct: z.number(),
      y_pct: z.number(),
    }),
  ),
  color: z.string().default("#ff2ef6"),
  width_px: z.number().positive().default(2),
});
export type CanvasStroke = z.infer<typeof CanvasStrokeSchema>;

/** Percent point on the design studio aerial canvas. */
export const CanvasPointPctSchema = z.object({
  x_pct: z.number(),
  y_pct: z.number(),
});
export type CanvasPointPct = z.infer<typeof CanvasPointPctSchema>;

/** Drip-line irrigation zone sketched on the studio canvas. */
export const IrrigationZoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  points: z.array(CanvasPointPctSchema).min(2),
  emitter_spacing_cm: z.number().positive().default(30),
  emitter_flow_lph: z.number().positive().default(2),
});
export type IrrigationZone = z.infer<typeof IrrigationZoneSchema>;

/** Sketch annotation — Stage 2-lite markup on Workflow 1 canvas (% geometry). */
export const CanvasAnnotationKindSchema = z.enum(["text", "dimension", "arrow"]);
export type CanvasAnnotationKind = z.infer<typeof CanvasAnnotationKindSchema>;

export const CanvasAnnotationSchema = z.object({
  id: z.string().uuid(),
  kind: CanvasAnnotationKindSchema,
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  x2_pct: z.number().min(0).max(100).optional(),
  y2_pct: z.number().min(0).max(100).optional(),
  text: z.string().max(240).optional(),
});
export type CanvasAnnotation = z.infer<typeof CanvasAnnotationSchema>;

/** Ephemeral AI ghost — never persisted until operator confirms. */
export const GhostPlacementSuggestionSchema = z.object({
  id: z.string(),
  symbol_id: z.string(),
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  /** Nearby accepted edit may have invalidated the suggestion rationale. */
  stale: z.boolean().optional(),
});
export type GhostPlacementSuggestion = z.infer<typeof GhostPlacementSuggestionSchema>;

export const DesignGhostsResponseSchema = z.object({
  suggestions: z.array(GhostPlacementSuggestionSchema),
});
export type DesignGhostsResponse = z.infer<typeof DesignGhostsResponseSchema>;

/** Natural-language sketch assist — operator message in, prose + ephemeral ghosts out. */
export const DesignAssistRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});
export type DesignAssistRequest = z.infer<typeof DesignAssistRequestSchema>;

export const DesignAssistResponseSchema = z.object({
  reply: z.string(),
  suggestions: z.array(GhostPlacementSuggestionSchema),
});
export type DesignAssistResponse = z.infer<typeof DesignAssistResponseSchema>;

/**
 * Workflow 1 % site geometry for HandoffDesignStudio.
 * Distinct from HITL SiteBoundary (geo/metres Vicmap lock).
 */
export const DesignSiteFramePointSchema = z.object({
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
});
export type DesignSiteFramePoint = z.infer<typeof DesignSiteFramePointSchema>;

export const DesignSiteFrameLevelSchema = z.object({
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  /** Reduced level (m AHD / local RL). */
  z_m: z.number(),
});
export type DesignSiteFrameLevel = z.infer<typeof DesignSiteFrameLevelSchema>;

export const DesignSiteFrameSchema = z.object({
  boundary: z.array(DesignSiteFramePointSchema).default([]),
  building: z.array(DesignSiteFramePointSchema).default([]),
  easements: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  services: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  levels: z.array(DesignSiteFrameLevelSchema).default([]),
});
export type DesignSiteFrame = z.infer<typeof DesignSiteFrameSchema>;

export const DesignCanvasSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema),
  irrigation_zones: z.array(IrrigationZoneSchema).default([]),
  annotations: z.array(CanvasAnnotationSchema).default([]),
  /** Lean landscape features (beds/paths) - optional until bed paint ships. */
  features: z.array(LandscapeFeatureSchema).optional().default([]),
  /** Durable title / survey frame — boundary, building, easements, levels. */
  site_frame: DesignSiteFrameSchema.optional(),
  updated_at: z.string().datetime(),
});
export type DesignCanvas = z.infer<typeof DesignCanvasSchema>;

export const UpsertDesignCanvasSchema = z.object({
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema).optional(),
  irrigation_zones: z.array(IrrigationZoneSchema).optional(),
  annotations: z.array(CanvasAnnotationSchema).optional(),
  features: z.array(LandscapeFeatureSchema).optional(),
  site_frame: DesignSiteFrameSchema.optional(),
});
export type UpsertDesignCanvasInput = z.infer<typeof UpsertDesignCanvasSchema>;

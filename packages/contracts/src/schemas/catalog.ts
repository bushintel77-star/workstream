import { z } from "zod";

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

export const DesignCanvasSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema),
  irrigation_zones: z.array(IrrigationZoneSchema).default([]),
  updated_at: z.string().datetime(),
});
export type DesignCanvas = z.infer<typeof DesignCanvasSchema>;

export const UpsertDesignCanvasSchema = z.object({
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema).optional(),
  irrigation_zones: z.array(IrrigationZoneSchema).optional(),
});
export type UpsertDesignCanvasInput = z.infer<typeof UpsertDesignCanvasSchema>;

import { z } from "zod";
import { LandscapeFeatureSchema } from "./landscape-feature";

export const CatalogCategorySchema = z.enum([
  "planting",
  "paving",
  "structure",
  "water",
  "annotation",
  "furniture",
  "lighting",
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
  lighting: "Lighting",
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
  /**
   * Existing-tree provenance — survives acceptance so every render surface
   * (plan, elevation, fit sheet, share) can distinguish a Vicmap urban tree
   * from a vision-detected canopy. See `treeSourceLabel` (domain). Optional so
   * pre-existing placements without a source still parse (treated as
   * operator-placed).
   */
  source: z.enum(["vicmap_tree", "canopy", "operator"]).optional(),
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

/**
 * Authored irrig / lighting / utility path on the studio canvas (% geometry).
 * - drip — irrigation laterals
 * - lighting — fixture run along path
 * - lighting_conduit — LV trench to house main fit-off
 * - spray — sprinkler lateral (indicative heads)
 * - agg_drain — aggregate / ag-pipe drain run
 */
export const IrrigationZoneKindSchema = z.enum([
  "drip",
  "lighting",
  "lighting_conduit",
  "spray",
  "agg_drain",
]);
export type IrrigationZoneKind = z.infer<typeof IrrigationZoneKindSchema>;

export const LvWireGaugeSchema = z.enum(["12/2", "14/2"]);
export type LvWireGauge = z.infer<typeof LvWireGaugeSchema>;

export const IrrigationZoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: IrrigationZoneKindSchema.default("drip"),
  points: z.array(CanvasPointPctSchema).min(2),
  emitter_spacing_cm: z.number().positive().default(30),
  emitter_flow_lph: z.number().positive().default(2),
  /** Lighting / spray — fixture or head spacing along path (m). */
  fixture_spacing_m: z.number().positive().default(2.5).optional(),
  /** Lighting circuit — LV cable gauge (session default 12/2). */
  wire_gauge: LvWireGaugeSchema.optional(),
  /** Lighting circuit — transformer VA rating (80% load rule). */
  transformer_va: z.number().positive().max(2000).optional(),
});
export type IrrigationZone = z.infer<typeof IrrigationZoneSchema>;

/**
 * Construction trench / conduit runs for landscape build (not survey Servc).
 * Proposed by auto-trench from zones + drains; accepted into the canvas.
 */
export const ConstructionTrenchKindSchema = z.enum([
  "irrig_main",
  "irrig_lateral",
  "lighting_conduit",
  "drainage",
]);
export type ConstructionTrenchKind = z.infer<typeof ConstructionTrenchKindSchema>;

export const ConstructionTrenchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: ConstructionTrenchKindSchema,
  points: z.array(CanvasPointPctSchema).min(2),
  /** Indicative trench depth (mm) — landscape construction, not DBYD. */
  depth_mm: z.number().positive().default(300),
  /** Provenance — auto proposal vs operator edit. */
  source: z.enum(["auto", "traced"]).default("auto"),
  /** Ephemeral until Accept — never ship ghosts to client quote. */
  ghost: z.boolean().optional(),
  why: z.string().optional(),
});
export type ConstructionTrench = z.infer<typeof ConstructionTrenchSchema>;

/** Hand-lettered plan note — persists with DesignCanvas (Workflow 1 presentation). */
export const CanvasAnnotationAnchorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    itemId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("point"),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
]);
export type CanvasAnnotationAnchor = z.infer<
  typeof CanvasAnnotationAnchorSchema
>;

export const CanvasAnnotationSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(140),
  anchor: CanvasAnnotationAnchorSchema,
  /** Note block position in board % — clamped toward plan margins in the UI. */
  notePos: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  createdAt: z.string().datetime(),
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
 * Cross-artefact finding over the whole board (BoardContext v1). Findings
 * propose only — accepting one is a human act, exactly like a ghost.
 */
export const BoardFindingKindSchema = z.enum([
  "canopy_conflict",
  "dig_conflict",
  "permeability",
  "quote_mismatch",
  "sheet_gap",
  "site_compliance",
  "overlay_watch",
  /** Twin: sediment / turbidity rising at an outlet sensor. */
  "sediment_buildup",
  /** Twin: soil moisture / heat stress on planting. */
  "vegetation_stress",
]);
export type BoardFindingKind = z.infer<typeof BoardFindingKindSchema>;

export const BoardFindingSeveritySchema = z.enum([
  "info",
  "watch",
  "critical",
]);
export type BoardFindingSeverity = z.infer<typeof BoardFindingSeveritySchema>;

/** Where a block's data came from — lets a reader weight the claim. */
export const BoardProvenanceSchema = z.enum([
  "vicmap",
  "operator",
  "derived",
  "seed",
  "absent",
]);
export type BoardProvenance = z.infer<typeof BoardProvenanceSchema>;

export const BoardFindingSchema = z.object({
  id: z.string(),
  kind: BoardFindingKindSchema,
  severity: BoardFindingSeveritySchema,
  title: z.string(),
  detail: z.string(),
  /** Artefacts reasoned over — the citation behind the claim. */
  cites: z.array(z.string()),
  /** Weakest provenance among the blocks used, so thin evidence reads thin. */
  basis: BoardProvenanceSchema,
  x: z.number().optional(),
  y: z.number().optional(),
});
export type BoardFinding = z.infer<typeof BoardFindingSchema>;

export const DesignFindingsResponseSchema = z.object({
  findings: z.array(BoardFindingSchema),
  /** Blocks the board cannot reason about — surfaced rather than papered over. */
  gaps: z.array(z.string()),
});
export type DesignFindingsResponse = z.infer<
  typeof DesignFindingsResponseSchema
>;

/**
 * Sustainability read-out over the same BoardContext the findings reason on.
 *
 * A metric is `absent` when the board never carried the input — the dashboard
 * says "not measured" rather than showing a comfortable zero.
 */
export const BoardMetricStatusSchema = z.enum([
  "on_track",
  "short",
  "measured",
  "absent",
]);
export type BoardMetricStatus = z.infer<typeof BoardMetricStatusSchema>;

export const BoardSustainabilityMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.string(),
  /** Benchmark the value is read against, when one applies. */
  target: z.number().nullable(),
  status: BoardMetricStatusSchema,
  /**
   * SITES v2 credit named by section and title rather than number — credit
   * numbering is not something this codebase can verify, and a wrong reference
   * on a sustainability claim is worse than none.
   */
  sites_credit: z.string(),
  /** UN SDG goal numbers this metric contributes to. */
  sdg: z.array(z.number().int()),
  statement: z.string(),
  /**
   * Named assumption when the figure is modelled rather than measured.
   *
   * **Invariant: a metric with `model` set must never be rendered without it.**
   * Every other metric is arithmetic over real board artefacts and can stand
   * alone; a modelled figure is the one a competitor can attack, and stripped
   * of its assumption it becomes a claim the practice cannot defend. Any
   * surface that shows the value — dock, sheet widget, export, prompt block —
   * shows the model note too, or omits the metric entirely.
   */
  model: z.string().nullable(),
  cites: z.array(z.string()),
  basis: BoardProvenanceSchema,
});
export type BoardSustainabilityMetric = z.infer<
  typeof BoardSustainabilityMetricSchema
>;

export const BoardSustainabilitySchema = z.object({
  metrics: z.array(BoardSustainabilityMetricSchema),
  /** Metrics the board could actually measure, out of those assessed. */
  measured: z.number().int(),
  assessed: z.number().int(),
});
export type BoardSustainability = z.infer<typeof BoardSustainabilitySchema>;

/**
 * Disclaimer the drawing's own content implies, prompted on export.
 *
 * Duty-of-care automation: the board knows it depicts mature canopy, or that a
 * trench crosses ground nobody has located, so it can say which notice belongs
 * on the issued set. Prompted, never auto-applied — wording that goes to a
 * client is the practice's to approve.
 */
export const BoardDisclaimerKindSchema = z.enum([
  "maturity",
  "design_intent",
  "subsurface",
  "tpo",
  "safety_waiver",
]);
export type BoardDisclaimerKind = z.infer<typeof BoardDisclaimerKindSchema>;

export const BoardDisclaimerSchema = z.object({
  id: z.string(),
  kind: BoardDisclaimerKindSchema,
  title: z.string(),
  /** The notice itself — this is the text that would go on the issued set. */
  statement: z.string(),
  /** What on the board called for it, in the operator's language. */
  trigger: z.string(),
  /** Required notices should not leave the practice without a decision. */
  required: z.boolean(),
  cites: z.array(z.string()),
  basis: BoardProvenanceSchema,
});
export type BoardDisclaimer = z.infer<typeof BoardDisclaimerSchema>;

export const DesignBoardReportResponseSchema = z.object({
  sustainability: BoardSustainabilitySchema,
  disclaimers: z.array(BoardDisclaimerSchema),
  /** Blocks the board cannot reason about — surfaced rather than papered over. */
  gaps: z.array(z.string()),
});
export type DesignBoardReportResponse = z.infer<
  typeof DesignBoardReportResponseSchema
>;

/**
 * Sketch → CAD translation (Claude vision).
 * The raw freehand sketch is rasterized client-side to a PNG and sent with the
 * site frame context; the model returns typed CAD ghost suggestions. Raw stroke
 * vectors travel alongside so the server can fall back to the heuristic
 * interpreter when the model / API key is unavailable.
 */
const SketchPointSchema = z.object({ x: z.number(), y: z.number() });

export const SketchToCadStrokeSchema = z.object({
  id: z.string(),
  points: z.array(SketchPointSchema),
});
export type SketchToCadStroke = z.infer<typeof SketchToCadStrokeSchema>;

export const SketchToCadRequestSchema = z.object({
  image_base64: z.string().min(1),
  mime_type: z
    .enum(["image/png", "image/jpeg", "image/webp"])
    .default("image/png"),
  boundary: z.array(SketchPointSchema).default([]),
  building: z.array(SketchPointSchema).default([]),
  strokes: z.array(SketchToCadStrokeSchema).default([]),
  scale_m: z.number().positive().optional(),
});
export type SketchToCadRequest = z.infer<typeof SketchToCadRequestSchema>;

export const SketchCadSuggestionSchema = z.object({
  id: z.string(),
  symbol_id: z.string(),
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  /** Suggested glyph scale for the studio item. */
  scale_hint: z.number().positive().max(6).optional(),
  /** Suggested rotation in degrees. */
  rot_deg: z.number().optional(),
  /**
   * Decimated drawn outline (board %) — present only for closed area masses
   * so the plan can render the region the operator actually drew.
   */
  outline_pct: z.array(CanvasPointPctSchema).max(64).optional(),
});
export type SketchCadSuggestion = z.infer<typeof SketchCadSuggestionSchema>;

export const SketchToCadResponseSchema = z.object({
  suggestions: z.array(SketchCadSuggestionSchema),
  rationale: z.string().optional(),
  /** Which engine produced the suggestions. */
  source: z.enum(["vision", "heuristic"]).default("heuristic"),
});
export type SketchToCadResponse = z.infer<typeof SketchToCadResponseSchema>;

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
  /**
   * Level provenance — who/what authored the figure.
   * - `authored`: operator-placed spot level (the default, legacy).
   * - `vicmap_contour`: derived from Vicmap contour interpolation (indicative,
   *   ±0.5–1 m typical for 1 m contour data). Surfaced as a fallback when no
   *   authored level exists nearby; never silently overrides an authored figure.
   * - `survey`: from a licensed survey (future — not yet wired).
   */
  source: z
    .enum(["authored", "vicmap_contour", "survey"])
    .optional(),
});
export type DesignSiteFrameLevel = z.infer<typeof DesignSiteFrameLevelSchema>;

/** Provenance for the existing-dwelling ring on the handoff board. */
export const DesignBuildingSourceSchema = z.enum([
  "vicmap",
  "traced",
  "empty",
]);
export type DesignBuildingSource = z.infer<typeof DesignBuildingSourceSchema>;

/**
 * BYDA / utility asset kind — distinct stroke language from title easements.
 * Geometry is operator-traced or BYDA-plan digitised (not Vicmap easement WFS).
 */
export const BydaAssetKindSchema = z.enum([
  "sewer",
  "stormwater",
  "water",
  "gas",
  "power",
  "nbn",
  "other",
]);
export type BydaAssetKind = z.infer<typeof BydaAssetKindSchema>;

export const DesignBydaAssetSchema = z.object({
  id: z.string().min(1),
  kind: BydaAssetKindSchema,
  ring: z.array(DesignSiteFramePointSchema).min(2),
  source: z.enum(["byda", "traced", "assumed"]).default("traced"),
});
export type DesignBydaAsset = z.infer<typeof DesignBydaAssetSchema>;

/** KEYLESS Vicmap/DELWP overlay washes (planning / bushfire / contour…). */
export const KeylessOverlayKindSchema = z.enum([
  "planning",
  "bushfire",
  "contour",
  "flood",
  "heritage",
  "easement",
  "urban_tree",
  "water_corp",
  "road_casement",
  "acid_sulfate",
  "wetland",
]);
export type KeylessOverlayKind = z.infer<typeof KeylessOverlayKindSchema>;

export const DesignKeylessOverlaySchema = z.object({
  kind: KeylessOverlayKindSchema,
  rings: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  label: z.string().optional(),
  fetched_at: z.string().datetime().optional(),
});
export type DesignKeylessOverlay = z.infer<typeof DesignKeylessOverlaySchema>;

/** Indicative drainage run between authored spot RLs (Workflow 1 — no TIN). */
export const DesignSiteFrameDrainageRunSchema = z.object({
  id: z.string(),
  points: z
    .array(
      z.object({
        x_pct: z.number().min(0).max(100),
        y_pct: z.number().min(0).max(100),
        z_m: z.number(),
      }),
    )
    .min(2),
  source: z.literal("indicative").default("indicative"),
});
export type DesignSiteFrameDrainageRun = z.infer<
  typeof DesignSiteFrameDrainageRunSchema
>;

/**
 * Adjacent-structure footprint used for sun/overshadowing so the design does
 * not sit in a vacuum. Indicative Workflow 1 massing — a footprint ring plus a
 * single height; no roof form, no survey grid (Stage 2 CAD territory).
 * `source` is the footprint provenance; `height_source` is tracked separately
 * because heights are usually assumed, and an assumed height must never be
 * presented as measured truth.
 */
export const DesignNeighbourBuildingSchema = z.object({
  id: z.string().min(1),
  /** Footprint polygon in board `%` coords (min 3 points). */
  ring: z.array(DesignSiteFramePointSchema).min(3),
  /**
   * Massing height in metres (eaves / parapet, ground to top). Optional —
   * absent means a downstream default storey assumption applies. When present
   * it wins over `storeys`.
   */
  height_m: z.number().positive().optional(),
  /** Alternative height expression; height_m is derived if only this is set. */
  storeys: z.number().int().positive().optional(),
  /** Footprint geometry provenance. */
  source: z.enum(["vicmap", "traced", "assumed"]).default("vicmap"),
  /** Height provenance — assumed by default; never label an assumption measured. */
  height_source: z
    .enum(["assumed", "measured", "operator"])
    .default("assumed"),
});
export type DesignNeighbourBuilding = z.infer<
  typeof DesignNeighbourBuildingSchema
>;

export const DesignSiteFrameSchema = z.object({
  boundary: z.array(DesignSiteFramePointSchema).default([]),
  building: z.array(DesignSiteFramePointSchema).default([]),
  easements: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  services: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  levels: z.array(DesignSiteFrameLevelSchema).default([]),
  drainage_runs: z.array(DesignSiteFrameDrainageRunSchema).default([]),
  /**
   * Typed underground / utility assets (BYDA language) — never conflated with
   * title easement hatches.
   */
  byda_assets: z.array(DesignBydaAssetSchema).default([]),
  /** Soft KEYLESS Vicmap washes (planning / bushfire / contours…). */
  keyless_overlays: z.array(DesignKeylessOverlaySchema).default([]),
  /**
   * Adjacent-structure footprints (+ massing height) for sun/overshadowing.
   * Real Vicmap footprints or operator-traced; never the synthetic
   * `neighbourLotContext` street fabric. Overshadowing reads these with
   * `north_bearing` to cast indicative shadows the design works around.
   */
  neighbour_buildings: z.array(DesignNeighbourBuildingSchema).default([]),
  /**
   * Ground truth for the board scale: metres represented by 100% board width.
   * Set when a Vicmap parcel is fitted (implied by the letterbox fit) or when
   * the operator calibrates; absent = legacy canvas on the 110 m default.
   */
  board_width_m: z.number().positive().optional(),
  /**
   * True-north orientation of the board, in degrees 0–360: the compass bearing,
   * clockwise from true north, that the top of the board (screen-up) points
   * toward. 0 = board-up is true north; 90 = board-up faces east. True north,
   * not magnetic; stamped by aerial / Vicmap calibration. Absent = orientation
   * not yet calibrated (legacy frames) — consumers treat absent as "unknown
   * orientation". The aspect quadrant (N/E/S/W) and any sun/overshadowing vector
   * are *computed* from this, never stored — keeps the field minimal and avoids
   * persisting a modelled figure. Sun/shade and neighbour-massing overshadowing
   * both consume this one value.
   */
  north_bearing: z.number().min(0).max(360).optional(),
  /**
   * How the dwelling ring was authored. Omit on legacy frames.
   * Never label seed / bbox-warped demo geometry as `"vicmap"`.
   */
  building_source: DesignBuildingSourceSchema.optional(),
  /**
   * Job intake chase list + dig override (Prepare site pack).
   * Dig tools require BYDA assets or an explicit override stamp.
   */
  site_pack: z
    .object({
      chase: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            done: z.boolean().default(false),
            href: z.string().optional(),
          }),
        )
        .default([]),
      dig_override_at: z.string().datetime().optional(),
      dig_override_note: z.string().max(280).optional(),
    })
    .optional(),
  /**
   * Machine-access override — an operator-measured side-corridor width in
   * millimetres. When present, it wins over the computed value (fences, gate
   * posts and meter boxes reduce the theoretical gap). `machine_access_source`
   * records whether the figure was measured on site or computed from title +
   * footprint geometry.
   */
  machine_access_override_mm: z.number().int().nonnegative().optional(),
  machine_access_source: z
    .enum(["computed", "measured"])
    .optional(),
});
export type DesignSiteFrame = z.infer<typeof DesignSiteFrameSchema>;
/** Pre-parse / hydrate input — defaults fill missing drainage_runs. */
export type DesignSiteFrameInput = z.input<typeof DesignSiteFrameSchema>;

/**
 * Fit-sheet presentation pack — widgets around the live plot (canvas feature).
 * See docs/SHEET-PRESENTATION.md.
 */
/**
 * Fit-sheet paper theme. Legacy `blush` (pink) migrates to `deep`
 * (dark-concept / --surface-deep) on parse.
 */
export const PresentationThemeSchema = z
  .string()
  .transform((v) => (v === "blush" ? "deep" : v))
  .pipe(z.enum(["parchment", "ink", "deep"]));
export type PresentationTheme = z.infer<typeof PresentationThemeSchema>;

/** Fit-sheet render pen — one geometry, multiple looks. */
export const PresentationPenSchema = z.enum([
  "technical",
  "hand_drawn",
  "grey_wash",
  "watercolour",
]);
export type PresentationPen = z.infer<typeof PresentationPenSchema>;

/**
 * Atmosphere Palette — curated pigments for selective colour (not a HEX picker).
 * graphite = greyscale base; cherry default accent per Curtis house style.
 */
export const AtmospherePigmentSchema = z.enum([
  "graphite",
  "cherry",
  "pale_blue",
  "terre_verte",
  "yellow_ochre",
  "burnt_umber",
  "sage",
]);
export type AtmospherePigment = z.infer<typeof AtmospherePigmentSchema>;

export const PresentationSlotSchema = z.enum([
  "title_meta",
  "side_stack",
  "footer_band",
]);
export type PresentationSlot = z.infer<typeof PresentationSlotSchema>;

export const PresentationWidgetTypeSchema = z.enum([
  "quote_total",
  "savings_ledger",
  "zone_summary",
  "material_swatches",
  "caption",
  "honesty_footer",
]);
export type PresentationWidgetType = z.infer<
  typeof PresentationWidgetTypeSchema
>;

/** Widget chrome accent — legacy `rose` migrates to `ink`. */
export const PresentationWidgetAccentSchema = z
  .string()
  .transform((v) => (v === "rose" ? "ink" : v))
  .pipe(z.enum(["ink", "sage", "gold"]));

export const PresentationWidgetStyleSchema = z.object({
  /** Accent wash for the widget chrome. */
  accent: PresentationWidgetAccentSchema.default("ink"),
  /** Emphasise display type (quote total / caption). */
  emphasis: z.enum(["quiet", "standard", "hero"]).default("standard"),
});
export type PresentationWidgetStyle = z.infer<
  typeof PresentationWidgetStyleSchema
>;

export const PresentationWidgetSchema = z.object({
  id: z.string().uuid(),
  type: PresentationWidgetTypeSchema,
  slot: PresentationSlotSchema,
  /** Order within the slot (0 = top / leading). */
  order: z.number().int().min(0).max(40).default(0),
  style: PresentationWidgetStyleSchema.default({
    accent: "ink",
    emphasis: "standard",
  }),
  /** Operator override copy — empty means live/auto text. */
  text: z.string().trim().max(280).optional(),
});
export type PresentationWidget = z.infer<typeof PresentationWidgetSchema>;

export const PresentationPackSchema = z.object({
  theme: PresentationThemeSchema.default("parchment"),
  /** Render pen — technical mono or freehand CAD pencil. */
  pen: PresentationPenSchema.default("technical"),
  /** Selective colour pigment — graphite = no accent wash. */
  atmosphere: AtmospherePigmentSchema.default("graphite"),
  /** Seed or saved template id last applied. */
  template_id: z.string().min(1).max(64).optional(),
  widgets: z.array(PresentationWidgetSchema).max(24).default([]),
});
export type PresentationPack = z.infer<typeof PresentationPackSchema>;

export const ImageBlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "color-burn",
  "color-dodge",
  "difference",
  "exclusion",
]);
export type ImageBlendMode = z.infer<typeof ImageBlendModeSchema>;

/** Imported photo or plan underlay that the operator can trace over. */
export const ImageLayerSchema = z.object({
  id: z.string().uuid(),
  /** Source file, if it is a project upload. */
  project_file_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  uri: z.string().url(),
  /** Natural aspect (width / height). Used to keep the image true as the board resizes. */
  natural_aspect: z.number().positive(),
  /** Centre in percent of the board. */
  x_pct: z.number().min(0).max(100).default(50),
  y_pct: z.number().min(0).max(100).default(50),
  /** Width in percent of the board. Height is derived from natural aspect. */
  width_pct: z.number().min(1).max(100).default(40),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(0.5),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  blend_mode: ImageBlendModeSchema.default("normal"),
  /**
   * Optional imagery capture date (ISO yyyy-mm-dd or yyyy). When present on
   * the aerial an operator uploaded, vision-detected canopy labels read
   * "Detected from 2023 imagery" instead of an undated circle. Populated by
   * EXIF parsing or a future Mapbox satellite pipeline; absent for undated
   * uploads.
   */
  capture_date: z.string().optional(),
});
export type ImageLayer = z.infer<typeof ImageLayerSchema>;

/**
 * ASLA/SILA-style design lifecycle — gates expected detail, not studio mode.
 * Distinct from ProjectStatus (pipeline) and StudioMode (survey/sketch/cad…).
 */
export const DesignLifecyclePhaseSchema = z.enum([
  "concept",
  "design_development",
  "construction_docs",
  "tendering",
  "construction_admin",
  "post_occupancy",
]);
export type DesignLifecyclePhase = z.infer<typeof DesignLifecyclePhaseSchema>;

export const DesignCanvasSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema),
  irrigation_zones: z.array(IrrigationZoneSchema).default([]),
  /** Landscape construction trenches / conduit (auto or traced). */
  construction_trenches: z.array(ConstructionTrenchSchema).default([]),
  annotations: z.array(CanvasAnnotationSchema).default([]),
  /** Imported photo / plan underlays for sketch tracing. */
  image_layers: z.array(ImageLayerSchema).default([]),
  /** Lean landscape features (beds/paths) - optional until bed paint ships. */
  features: z.array(LandscapeFeatureSchema).optional().default([]),
  /** Durable title / survey frame — boundary, building, easements, levels. */
  site_frame: DesignSiteFrameSchema.optional(),
  /** Fit-sheet presentation product (widgets + theme). */
  presentation_pack: PresentationPackSchema.optional(),
  /** Operator-set ASLA/SILA lifecycle phase for the board. */
  lifecycle_phase: DesignLifecyclePhaseSchema.optional(),
  updated_at: z.string().datetime(),
});
export type DesignCanvas = z.infer<typeof DesignCanvasSchema>;

export const UpsertDesignCanvasSchema = z.object({
  placements: z.array(CatalogPlacementSchema),
  strokes: z.array(CanvasStrokeSchema).optional(),
  irrigation_zones: z.array(IrrigationZoneSchema).optional(),
  construction_trenches: z.array(ConstructionTrenchSchema).optional(),
  annotations: z.array(CanvasAnnotationSchema).optional(),
  image_layers: z.array(ImageLayerSchema).optional(),
  features: z.array(LandscapeFeatureSchema).optional(),
  site_frame: DesignSiteFrameSchema.optional(),
  presentation_pack: PresentationPackSchema.optional(),
  lifecycle_phase: DesignLifecyclePhaseSchema.optional(),
});
export type UpsertDesignCanvasInput = z.infer<typeof UpsertDesignCanvasSchema>;

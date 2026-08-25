import { z } from "zod";
import {
  ImageLayerSchema,
  PresentationWidgetSchema,
  PresentationWidgetTypeSchema,
} from "./catalog";

/**
 * Present workspace — multi-page presentation documents for print-ready decks,
 * quotations, mood boards and concept sketches.
 *
 * See docs/PRESENT-WORKSPACE-BRIEF.md. This is the Present-tab surface
 * (editorial, template-led, multi-page). The fit-sheet `PresentationPack`
 * (single-sheet, in-studio) is a separate schema in catalog.ts and is
 * unchanged.
 *
 * Persistence: separate entity keyed by project_id (like ShareRevision), not
 * embedded in the Project row or inside DesignCanvas. "The plan never writes
 * back" — the Present workspace reads the plan; it never writes to DesignCanvas.
 */

// --- Paper + page furniture ---

export const PresentationPaperSizeSchema = z.enum(["a3", "a4"]);
export type PresentationPaperSize = z.infer<
  typeof PresentationPaperSizeSchema
>;

export const PresentationPaperOrientationSchema = z.enum([
  "landscape",
  "portrait",
]);
export type PresentationPaperOrientation = z.infer<
  typeof PresentationPaperOrientationSchema
>;

/**
 * Persisted title block for a presentation page. The live ArchitecturalTitleBlock
 * (domain) is computed from Vicmap/survey at render time; this schema captures
 * only the editable override fields the designer sets on a deck page.
 */
export const PresentationTitleBlockSchema = z.object({
  /** Project / sheet title — defaults to the project address. */
  title: z.string().trim().max(200).default(""),
  /** Subtitle / sheet description (e.g. "Landscape concept plan"). */
  subtitle: z.string().trim().max(200).default(""),
  /** Practice / studio name. */
  practice: z.string().trim().max(200).default(""),
  /** Drawing revision letter (A, B, …). */
  revision: z.string().trim().max(10).default(""),
  /** Date string shown on the title block. */
  date_label: z.string().trim().max(40).default(""),
  /** Scale label (e.g. "1:100 @ A3"). */
  scale_label: z.string().trim().max(40).default(""),
});
export type PresentationTitleBlock = z.infer<
  typeof PresentationTitleBlockSchema
>;

export const PresentationPageMarginsSchema = z.object({
  top_mm: z.number().positive().default(15),
  right_mm: z.number().positive().default(15),
  bottom_mm: z.number().positive().default(15),
  left_mm: z.number().positive().default(15),
});
export type PresentationPageMargins = z.infer<
  typeof PresentationPageMarginsSchema
>;

// --- Theme (capped palette, single highlight, font enum) ---

/**
 * Capped editorial palette — a handful of curated colour schemes, not an open
 * picker. Each names a base / ink / paper combination in the Curtis house style.
 */
export const PresentationPaletteSchema = z
  .string()
  .transform((v) => (v === "parchment" ? "paper" : v))
  .pipe(
    z.enum([
      "stone",
      "sage",
      "ink",
      "blush",
      "paper",
    ]),
  );
export type PresentationPalette = z.infer<typeof PresentationPaletteSchema>;

/**
 * Architectural-style fonts plus one hand-written style. Reuses the studio's
 * Garden Atelier faces (Fraunces + Sora) and adds a hand-written option for
 * concept sketches.
 */
export const PresentationFontSchema = z.enum([
  "fraunces",
  "sora",
  "inter",
  "handwritten",
]);
export type PresentationFont = z.infer<typeof PresentationFontSchema>;

export const PresentationDocumentThemeSchema = z.object({
  palette: PresentationPaletteSchema.default("stone"),
  /** One highlight colour only — used for annotations / accents. */
  highlight_colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Highlight must be a #RRGGBB hex")
    .default("#b33a32"),
  font: PresentationFontSchema.default("fraunces"),
  /** Reuse pen / atmosphere from the fit-sheet pack where they already fit. */
  pen: z
    .enum(["technical", "hand_drawn", "grey_wash", "watercolour"])
    .default("technical"),
});
export type PresentationDocumentTheme = z.infer<
  typeof PresentationDocumentThemeSchema
>;

// --- Template enum (closed, 4-5 editorial templates) ---

/**
 * Closed enum of editorial templates. Each defines its named slots: blurb,
 * four drawing squares, labour + product schedule. Scoped to
 * PresentationDocument only — the fit-sheet PresentationPack keeps its own
 * free-string template_id and is unchanged.
 */
export const PresentationTemplateIdSchema = z.enum([
  "editorial_classic",
  "editorial_minimal",
  "editorial_feature",
  "editorial_schedule",
  "client_build_pack",
  "subcontractor_build_pack",
]);
export type PresentationTemplateId = z.infer<
  typeof PresentationTemplateIdSchema
>;

// --- Deliverable type ---

export const PresentationDeliverableTypeSchema = z.enum([
  "deck",
  "quotation",
  "mood_board",
  "concept_sketch",
  "client_pack",
  "subcontractor_pack",
]);
export type PresentationDeliverableType = z.infer<
  typeof PresentationDeliverableTypeSchema
>;

// --- Panel discriminated union ---

/**
 * Layout rect in percent of the page content area (0-100). Extends the
 * %-coordinate model already used by ImageLayer, but across an ordered set of
 * pages rather than one sheet.
 */
export const PanelRectSchema = z.object({
  x_pct: z.number().min(0).max(100).default(0),
  y_pct: z.number().min(0).max(100).default(0),
  w_pct: z.number().min(1).max(100).default(100),
  h_pct: z.number().min(1).max(100).default(100),
});
export type PanelRect = z.infer<typeof PanelRectSchema>;

/**
 * Design-logic reason tag for a plan crop — why AI cut where it cut.
 * Title-centric: the site truth (orientation, aspect, frontage) leads the cut.
 */
export const PlanCropReasonSchema = z.enum([
  "overview",
  "feature",
  "aspect",
  "elevation",
  "section",
]);
export type PlanCropReason = z.infer<typeof PlanCropReasonSchema>;

/**
 * Plan revision the panel pins to on placement (ghost-until-accept).
 * Drag-arranging is stable because the panel renders against a fixed revision;
 * an explicit "sync to latest" action bumps this to the current canvas revision.
 * Issued decks freeze by default.
 */
export const PlanCropRefSchema = z.object({
  /** DesignCanvas.save_revision at placement time. */
  canvas_revision: z.number().int().nonnegative(),
  /** Crop rect inside the plan board (% of board). */
  crop: PanelRectSchema,
  reason: PlanCropReasonSchema,
  /** Panel name (e.g. "North terrace", "Courtyard detail"). */
  label: z.string().trim().max(120).default(""),
  /** Whether the panel is synced to the latest plan revision. */
  synced: z.boolean().default(true),
});
export type PlanCropRef = z.infer<typeof PlanCropRefSchema>;

const basePanelFields = {
  id: z.string().uuid(),
  /** Layout position on the page (% of content area). */
  rect: PanelRectSchema.default({
    x_pct: 0,
    y_pct: 0,
    w_pct: 100,
    h_pct: 100,
  }),
  /** Stack order within the page (higher = on top). */
  z_index: z.number().int().default(0),
} as const;

export const PlanCropPanelSchema = z.object({
  ...basePanelFields,
  kind: z.literal("plan_crop"),
  ref: PlanCropRefSchema,
});
export type PlanCropPanel = z.infer<typeof PlanCropPanelSchema>;

export const ImagePanelSchema = z.object({
  ...basePanelFields,
  kind: z.literal("image"),
  /** Reuse ImageLayerSchema (imported photo / plan underlay). */
  layer: ImageLayerSchema,
});
export type ImagePanel = z.infer<typeof ImagePanelSchema>;

export const WidgetPanelSchema = z.object({
  ...basePanelFields,
  kind: z.literal("widget"),
  /** Reuse typed widgets (quote_total, savings_ledger, zone_summary, etc.). */
  widget: PresentationWidgetSchema,
});
export type WidgetPanel = z.infer<typeof WidgetPanelSchema>;

export const TextPanelSchema = z.object({
  ...basePanelFields,
  kind: z.literal("text"),
  /** Heading / body text block. */
  heading: z.string().trim().max(200).default(""),
  body: z.string().max(2000).default(""),
  /** Text size role in the editorial hierarchy. */
  role: z.enum(["heading", "subheading", "body", "caption"]).default("body"),
});
export type TextPanel = z.infer<typeof TextPanelSchema>;

export const SwatchBoardPanelSchema = z.object({
  ...basePanelFields,
  kind: z.literal("swatch_board"),
  /** Material swatch IDs from the placed materials catalog. */
  swatch_ids: z.array(z.string().min(1)).default([]),
  /** Grid columns (2-6). */
  columns: z.number().int().min(2).max(6).default(3),
  /** Optional caption under the grid. */
  caption: z.string().trim().max(280).default(""),
});
export type SwatchBoardPanel = z.infer<typeof SwatchBoardPanelSchema>;

export const PresentationPanelSchema = z.discriminatedUnion("kind", [
  PlanCropPanelSchema,
  ImagePanelSchema,
  WidgetPanelSchema,
  TextPanelSchema,
  SwatchBoardPanelSchema,
]);
export type PresentationPanel = z.infer<typeof PresentationPanelSchema>;

// --- Page ---

export const PresentationPageSchema = z.object({
  id: z.string().uuid(),
  /** Page order in the document (0 = first). */
  order: z.number().int().min(0).default(0),
  paper_size: PresentationPaperSizeSchema.default("a3"),
  orientation: PresentationPaperOrientationSchema.default("landscape"),
  title_block: PresentationTitleBlockSchema.default({}),
  margins: PresentationPageMarginsSchema.default({}),
  panels: z.array(PresentationPanelSchema).default([]),
});
export type PresentationPage = z.infer<typeof PresentationPageSchema>;

// --- Document ---

export const PresentationDocumentStatusSchema = z.enum(["draft", "issued"]);
export type PresentationDocumentStatus = z.infer<
  typeof PresentationDocumentStatusSchema
>;

/**
 * Frozen estimate readout captured at Issue. Widgets read this after issue
 * instead of live board totals — live figures become a fixed snapshot.
 */
export const PresentationEstimateSnapshotSchema = z.object({
  totalInclGst: z.number(),
  materialsExGst: z.number(),
  gst: z.number(),
  hardscapeM2: z.number(),
  excavateM3: z.number(),
  lines: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      unit: z.string(),
      qty: z.number(),
      total: z.number(),
    }),
  ),
  captured_at: z.string().datetime(),
});
export type PresentationEstimateSnapshot = z.infer<
  typeof PresentationEstimateSnapshotSchema
>;

export const PresentationDocumentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().min(1),
  /** Document title (e.g. "Wrights Terrace — concept deck"). */
  title: z.string().trim().max(200).default("Untitled deck"),
  deliverable_type: PresentationDeliverableTypeSchema.default("deck"),
  template_id: PresentationTemplateIdSchema.default("editorial_classic"),
  theme: PresentationDocumentThemeSchema.default({}),
  status: PresentationDocumentStatusSchema.default("draft"),
  pages: z.array(PresentationPageSchema).min(1).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  /** Set when the deck is issued (frozen). Issued decks freeze by default. */
  issued_at: z.string().datetime().nullable().optional(),
  /** Estimate frozen at issue — widgets prefer this over live board data. */
  estimate_snapshot: PresentationEstimateSnapshotSchema.nullable().optional(),
});
export type PresentationDocument = z.infer<
  typeof PresentationDocumentSchema
>;

// --- API inputs ---

export const CreatePresentationDocumentInputSchema = z.object({
  title: z.string().trim().max(200).optional(),
  deliverable_type: PresentationDeliverableTypeSchema.optional(),
  template_id: PresentationTemplateIdSchema.optional(),
  theme: PresentationDocumentThemeSchema.partial().optional(),
});
export type CreatePresentationDocumentInput = z.infer<
  typeof CreatePresentationDocumentInputSchema
>;

export const UpdatePresentationDocumentInputSchema = z.object({
  title: z.string().trim().max(200).optional(),
  deliverable_type: PresentationDeliverableTypeSchema.optional(),
  template_id: PresentationTemplateIdSchema.optional(),
  theme: PresentationDocumentThemeSchema.partial().optional(),
  status: PresentationDocumentStatusSchema.optional(),
  pages: z.array(PresentationPageSchema).optional(),
  estimate_snapshot: PresentationEstimateSnapshotSchema.nullable().optional(),
});
export type UpdatePresentationDocumentInput = z.infer<
  typeof UpdatePresentationDocumentInputSchema
>;

// --- Plan dissection (Phase 2 — AI plan dissection) ---

/**
 * A proposed plan crop generated by dissecting the finished DesignCanvas.
 * Ghosts are ephemeral review state — they are NOT persisted to the document
 * until the designer accepts them, at which point they become PlanCropPanel
 * entries pinned to `canvas_revision`. Matches the AI-CAD ghost-until-accept
 * pattern: propose → review → accept/re-crop/reject.
 *
 * The dissection is title-centric (brief §5.1): the site truth (orientation,
 * aspect, frontage) leads the cut. Aspect quadrants are computed from
 * `DesignSiteFrame.north_bearing`; feature clusters are derived from
 * placement proximity. Heuristic-first (deterministic, testable); the vision
 * pipeline can enhance later.
 */
export const PresentationDissectGhostSchema = z.object({
  /** Crop rect inside the plan board (% of board). */
  crop: PanelRectSchema,
  reason: PlanCropReasonSchema,
  /** Panel name (e.g. "North terrace", "Site plan overview"). */
  label: z.string().trim().max(120).default(""),
});
export type PresentationDissectGhost = z.infer<
  typeof PresentationDissectGhostSchema
>;

/**
 * Response from the plan dissection endpoint. `canvas_revision` is the plan
 * revision the ghosts were generated against (epoch ms of DesignCanvas.updated_at).
 * Accepted panels pin to this revision; "sync to latest" bumps it.
 *
 * `source` indicates which generation path produced the ghosts:
 * - `heuristic` — deterministic, no Claude call (default / fallback).
 * - `vision` — Claude analysed the structured plan data and enhanced the
 *   heuristic cuts with semantic feature-area labels (courtyard, terrace, etc.).
 */
export const PresentationDissectResponseSchema = z.object({
  canvas_revision: z.number().int().nonnegative(),
  ghosts: z.array(PresentationDissectGhostSchema).default([]),
  source: z.enum(["heuristic", "vision"]).default("heuristic"),
});
export type PresentationDissectResponse = z.infer<
  typeof PresentationDissectResponseSchema
>;

// --- AI editorial formatting (Phase 3) ---

/**
 * Request to the editorial formatting endpoint. The formatter takes the
 * panels on a page + the deliverable type + template, and proposes a layout
 * (rect for each panel) in the Curtis house style. Title-centric: the site
 * truth leads the composition.
 */
export const PresentationFormatRequestSchema = z.object({
  deliverable_type: PresentationDeliverableTypeSchema,
  template_id: PresentationTemplateIdSchema,
  /** Panels on the page to lay out (id + kind + reason for plan crops). */
  panels: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum([
          "plan_crop",
          "image",
          "widget",
          "text",
          "swatch_board",
        ]),
        /** For plan_crop panels — the reason tag drives placement priority. */
        reason: PlanCropReasonSchema.optional(),
        /** For widget panels — the widget type drives slot assignment. */
        widget_type: PresentationWidgetTypeSchema.optional(),
        /** For text panels — the role drives hierarchy. */
        role: z
          .enum(["heading", "subheading", "body", "caption"])
          .optional(),
      }),
    )
    .default([]),
});
export type PresentationFormatRequest = z.infer<
  typeof PresentationFormatRequestSchema
>;

/**
 * A proposed layout for a single panel. The formatter returns rects in % of
 * the page content area (0-100), matching the panel rect model. Ghosts are
 * ephemeral — the designer reviews and accepts.
 */
export const PresentationFormatGhostSchema = z.object({
  id: z.string().uuid(),
  rect: PanelRectSchema,
  /** Why the formatter placed this panel here (for the review UI). */
  rationale: z.string().trim().max(280).default(""),
});
export type PresentationFormatGhost = z.infer<
  typeof PresentationFormatGhostSchema
>;

export const PresentationFormatResponseSchema = z.object({
  ghosts: z.array(PresentationFormatGhostSchema).default([]),
  /** Overall layout rationale (house style reasoning). */
  rationale: z.string().trim().max(500).default(""),
  source: z.enum(["heuristic", "vision"]).default("heuristic"),
});
export type PresentationFormatResponse = z.infer<
  typeof PresentationFormatResponseSchema
>;

import { z } from "zod";

/** Metres from document origin (lot SW / canvas origin). */
export const CadPoint2dSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type CadPoint2d = z.infer<typeof CadPoint2dSchema>;

export const CadLayerSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.number().int().min(1).max(255).optional(),
  frozen: z.boolean().optional(),
});
export type CadLayer = z.infer<typeof CadLayerSchema>;

const CadEntityBase = {
  id: z.string().uuid(),
  layer: z.string().min(1),
  /** AI-proposed until operator accepts. */
  ghost: z.boolean().default(false),
};

export const CadLineEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("line"),
  start: CadPoint2dSchema,
  end: CadPoint2dSchema,
});

export const CadPolylineEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("polyline"),
  points: z.array(CadPoint2dSchema).min(2),
  closed: z.boolean().default(false),
});

export const CadCircleEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("circle"),
  center: CadPoint2dSchema,
  radius: z.number().positive(),
});

export const CadArcEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("arc"),
  center: CadPoint2dSchema,
  radius: z.number().positive(),
  start_angle_deg: z.number(),
  end_angle_deg: z.number(),
});

export const CadTextEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("text"),
  position: CadPoint2dSchema,
  height: z.number().positive(),
  value: z.string().max(500),
  rotation_deg: z.number().default(0),
});

export const CadInsertEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("insert"),
  block_name: z.string().min(1),
  position: CadPoint2dSchema,
  scale: z.number().positive().default(1),
  rotation_deg: z.number().default(0),
});

export const CadDimensionEntitySchema = z.object({
  ...CadEntityBase,
  kind: z.literal("dimension"),
  p1: CadPoint2dSchema,
  p2: CadPoint2dSchema,
  offset: z.number().default(0.5),
});

export const CadEntitySchema = z.discriminatedUnion("kind", [
  CadLineEntitySchema,
  CadPolylineEntitySchema,
  CadCircleEntitySchema,
  CadArcEntitySchema,
  CadTextEntitySchema,
  CadInsertEntitySchema,
  CadDimensionEntitySchema,
]);
export type CadEntity = z.infer<typeof CadEntitySchema>;

export const CadBlockSchema = z.object({
  name: z.string().min(1),
  /** Curtis catalog symbol id when this block maps to a library asset. */
  symbol_id: z.string().optional(),
  entities: z.array(CadEntitySchema).default([]),
});
export type CadBlock = z.infer<typeof CadBlockSchema>;

/** Stage 2 AI CAD document — metre space, DXF-exportable. */
export const CadDocumentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  version: z.literal(1),
  units: z.literal("m"),
  /** World origin of canvas (0,0); informational for georef later. */
  origin: CadPoint2dSchema.default({ x: 0, y: 0 }),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  layers: z.array(CadLayerSchema),
  entities: z.array(CadEntitySchema),
  blocks: z.array(CadBlockSchema).default([]),
  ai_run_id: z.string().nullable().default(null),
  source_sketch_id: z.string().uuid().nullable().default(null),
  updated_at: z.string().datetime(),
});
export type CadDocument = z.infer<typeof CadDocumentSchema>;

export const UpsertCadDocumentSchema = z.object({
  version: z.literal(1).default(1),
  units: z.literal("m").default("m"),
  origin: CadPoint2dSchema.optional(),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  layers: z.array(CadLayerSchema),
  entities: z.array(CadEntitySchema),
  blocks: z.array(CadBlockSchema).optional(),
  ai_run_id: z.string().nullable().optional(),
  source_sketch_id: z.string().uuid().nullable().optional(),
});
export type UpsertCadDocumentInput = z.infer<typeof UpsertCadDocumentSchema>;

/** Deterministic ops the LLM emits; engine applies to CadDocument. */
export const CadOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_layer"),
    name: z.string().min(1).max(64),
    color: z.number().int().min(1).max(255).optional(),
  }),
  z.object({
    op: z.literal("add_line"),
    layer: z.string().min(1),
    start: CadPoint2dSchema,
    end: CadPoint2dSchema,
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_polyline"),
    layer: z.string().min(1),
    points: z.array(CadPoint2dSchema).min(2),
    closed: z.boolean().default(false),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_circle"),
    layer: z.string().min(1),
    center: CadPoint2dSchema,
    radius: z.number().positive(),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_arc"),
    layer: z.string().min(1),
    center: CadPoint2dSchema,
    radius: z.number().positive(),
    start_angle_deg: z.number(),
    end_angle_deg: z.number(),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_text"),
    layer: z.string().min(1),
    position: CadPoint2dSchema,
    height: z.number().positive().default(0.35),
    value: z.string().max(500),
    rotation_deg: z.number().default(0),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_insert"),
    layer: z.string().min(1),
    block_name: z.string().min(1),
    position: CadPoint2dSchema,
    scale: z.number().positive().default(1),
    rotation_deg: z.number().default(0),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("add_dim"),
    layer: z.string().min(1),
    p1: CadPoint2dSchema,
    p2: CadPoint2dSchema,
    offset: z.number().default(0.5),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("offset_polyline"),
    entity_id: z.string().uuid(),
    distance: z.number(),
    ghost: z.boolean().default(true),
  }),
  z.object({
    op: z.literal("delete_entity"),
    entity_id: z.string().uuid(),
  }),
]);
export type CadOp = z.infer<typeof CadOpSchema>;

export const CadOpsBatchSchema = z.object({
  ops: z.array(CadOpSchema).max(200),
  rationale: z.string().max(2000).optional(),
});
export type CadOpsBatch = z.infer<typeof CadOpsBatchSchema>;

export const CadGenerateRequestSchema = z.object({
  width_m: z.number().positive().optional(),
  height_m: z.number().positive().optional(),
});
export type CadGenerateRequest = z.infer<typeof CadGenerateRequestSchema>;

export const CadEditRequestSchema = z.object({
  instruction: z.string().min(1).max(2000),
});
export type CadEditRequest = z.infer<typeof CadEditRequestSchema>;

export const CadAcceptRequestSchema = z.object({
  entity_ids: z.array(z.string().uuid()).optional(),
});
export type CadAcceptRequest = z.infer<typeof CadAcceptRequestSchema>;

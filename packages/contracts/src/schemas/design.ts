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

export const DesignSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  mode: DesignModeSchema,
  proposal: z.record(z.unknown()),
  gaps: z.array(GapFlagSchema),
  rationale: z.string(),
  version: z.number().int().positive(),
});
export type Design = z.infer<typeof DesignSchema>;

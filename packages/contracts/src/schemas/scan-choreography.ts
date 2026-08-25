import { z } from "zod";

/**
 * Scan choreography contract — the ordered, category-aware site-truth
 * reveal events shared by the store clock, the overlay labels and the
 * scene director (zod-validated so all three cannot drift).
 */

export const ScanStageNameSchema = z.enum([
  "cadastre",
  "parcels",
  "services",
  "terrain",
  "flora",
]);
export type ScanStageName = z.infer<typeof ScanStageNameSchema>;

export const ScanRevealModeSchema = z.enum([
  "draw",
  "extrude",
  "antpath",
  "fade",
  "grow",
]);
export type ScanRevealMode = z.infer<typeof ScanRevealModeSchema>;

export const ScanStageEventSchema = z.object({
  stage: ScanStageNameSchema,
  mode: ScanRevealModeSchema,
  /** Stage dwell (ms) — the director lerps 0→1 across it. */
  durationMs: z.number().int().min(200).max(4000),
  /** Operator-facing stage label with the real count. */
  label: z.string().min(1),
  /** Entity count backing the stage (chips/tests assert on it). */
  count: z.number().int().min(1),
});
export type ScanStageEvent = z.infer<typeof ScanStageEventSchema>;

export const ScanChoreographySchema = z.object({
  events: z.array(ScanStageEventSchema).min(1),
});
export type ScanChoreography = z.infer<typeof ScanChoreographySchema>;

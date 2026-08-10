import { z } from "zod";

export const StageFindingSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  evidence: z.unknown(),
});
export type StageFinding = z.infer<typeof StageFindingSchema>;

export const StageGuardSchema = z.object({
  name: z.string(),
  threshold: z.number(),
  value: z.number(),
  passed: z.boolean(),
});
export type StageGuard = z.infer<typeof StageGuardSchema>;

export const StageLogSchema = z.object({
  stage: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  attempts: z.number().int().nonnegative(),
  passed: z.boolean(),
  findings: z.array(StageFindingSchema),
  guard: z.array(StageGuardSchema),
  status: z.enum(["running", "passed", "failed", "skipped"]),
  error: z.string().nullable().optional(),
});
export type StageLog = z.infer<typeof StageLogSchema>;

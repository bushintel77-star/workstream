import { z } from "zod";

export const AuditSeveritySchema = z.enum(["blocking", "advisory"]);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

export const AuditCategorySchema = z.enum([
  "fidelity",
  "completeness",
  "coherence",
  "cost",
  "safety",
  "scope",
]);
export type AuditCategory = z.infer<typeof AuditCategorySchema>;

export const AuditFindingSchema = z.object({
  severity: AuditSeveritySchema,
  category: AuditCategorySchema,
  location: z.string(),
  statement: z.string(),
  suggested_action: z.string(),
});
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const AuditSchema = z.object({
  id: z.string().uuid(),
  design_id: z.string().uuid(),
  findings: z.array(AuditFindingSchema),
  blocking_count: z.number().int().nonnegative(),
  advisory_count: z.number().int().nonnegative(),
  passed: z.boolean(),
});
export type Audit = z.infer<typeof AuditSchema>;

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

export const OverrideSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  audit_id: z.string().uuid(),
  finding_index: z.number().int().nonnegative(),
  category: AuditCategorySchema,
  location: z.string(),
  reason: z.string().min(8),
  created_at: z.string().datetime(),
});
export type Override = z.infer<typeof OverrideSchema>;

export const CreateOverrideInputSchema = z.object({
  finding_index: z.number().int().nonnegative(),
  reason: z.string().min(8, "Override reason must be at least 8 characters"),
});
export type CreateOverrideInput = z.infer<typeof CreateOverrideInputSchema>;

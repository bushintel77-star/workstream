import { z } from "zod";

/** Operator audit trail for destructive / reversible actions. */
export const ActivityActionSchema = z.enum([
  "project.deleted",
  "project.restored",
  "project_file.deleted",
  "crew_member.deleted",
  "catalog_symbol.deleted",
  "integration.deleted",
  "sku_link.deleted",
]);
export type ActivityAction = z.infer<typeof ActivityActionSchema>;

export const ActivityEventSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  /** Null for workspace-level events (crew, catalog, integrations). */
  project_id: z.string().uuid().nullable(),
  action: ActivityActionSchema,
  /** Related entity id or key when applicable. */
  subject_id: z.string().nullable(),
  detail: z.string().min(1).max(500),
  created_at: z.string().datetime(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

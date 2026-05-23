import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "draft",
  "recording",
  "processing",
  "survey_review",
  "design_review",
  "cost_review",
  "audit",
  "outputs",
  "complete",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const CrmStageSchema = z.enum([
  "enquiry",
  "quote_sent",
  "won",
  "lost",
]);
export type CrmStage = z.infer<typeof CrmStageSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  address: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  created_at: z.string().datetime(),
  status: ProjectStatusSchema,
  client_name: z.string().nullable().optional(),
  client_email: z.string().email().nullable().optional(),
  crm_stage: CrmStageSchema.nullable().optional(),
  crm_synced_at: z.string().datetime().nullable().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = z.object({
  address: z.string().min(5),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectStatusInputSchema = z.object({
  status: ProjectStatusSchema,
});
export type UpdateProjectStatusInput = z.infer<
  typeof UpdateProjectStatusInputSchema
>;

export const UpdateProjectClientInputSchema = z.object({
  client_name: z.string().min(1).max(200).nullable().optional(),
  client_email: z.string().email().nullable().optional(),
  crm_stage: CrmStageSchema.nullable().optional(),
});
export type UpdateProjectClientInput = z.infer<
  typeof UpdateProjectClientInputSchema
>;

export const CRM_STAGE_LABEL: Record<CrmStage, string> = {
  enquiry: "Enquiry",
  quote_sent: "Quote sent",
  won: "Won",
  lost: "Lost",
};

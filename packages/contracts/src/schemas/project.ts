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

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  address: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  created_at: z.string().datetime(),
  status: ProjectStatusSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = z.object({
  address: z.string().min(5),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

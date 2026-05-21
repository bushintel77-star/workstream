import { z } from "zod";

export const ProjectFileKindSchema = z.enum([
  "plan",
  "design",
  "site_photo",
  "permit",
  "reference",
  "other",
]);
export type ProjectFileKind = z.infer<typeof ProjectFileKindSchema>;

export const PROJECT_FILE_KIND_LABEL: Record<ProjectFileKind, string> = {
  plan: "Plan",
  design: "Design",
  site_photo: "Site photo",
  permit: "Permit",
  reference: "Reference",
  other: "Other",
};

export const ProjectFileSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string(),
  kind: ProjectFileKindSchema,
  title: z.string().min(1).max(200),
  mime_type: z.string(),
  uri: z.string().url(),
  created_at: z.string().datetime(),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const CreateProjectFileInputSchema = z.object({
  kind: ProjectFileKindSchema.optional(),
  title: z.string().min(1).max(200).optional(),
});
export type CreateProjectFileInput = z.infer<typeof CreateProjectFileInputSchema>;

export const GalleryItemSchema = z.object({
  id: z.string(),
  source: z.enum(["filing", "aerial", "measurement", "output"]),
  kind: z.string(),
  title: z.string(),
  mime_type: z.string(),
  uri: z.string().url(),
  viewable: z.boolean(),
  created_at: z.string().datetime(),
});
export type GalleryItem = z.infer<typeof GalleryItemSchema>;

import { z } from "zod";

/**
 * Issued documentation pack — schedules + Present/Fit snapshots frozen at issue.
 * Landscape-ops first (2C); not IFC/Revit.
 */

export const DocumentationPackageStatusSchema = z.enum(["draft", "issued"]);
export type DocumentationPackageStatus = z.infer<
  typeof DocumentationPackageStatusSchema
>;

export const DocumentationScheduleKindSchema = z.enum([
  "planting",
  "trench",
  "lighting",
  "material",
]);
export type DocumentationScheduleKind = z.infer<
  typeof DocumentationScheduleKindSchema
>;

export const DocumentationScheduleSnapshotSchema = z.object({
  kind: DocumentationScheduleKindSchema,
  title: z.string().min(1).max(120),
  /** Opaque rows — schedule builders define shape; frozen at issue. */
  rows: z.array(z.record(z.unknown())).default([]),
  honesty: z.string().max(500).optional(),
  captured_at: z.string().datetime(),
});
export type DocumentationScheduleSnapshot = z.infer<
  typeof DocumentationScheduleSnapshotSchema
>;

export const DocumentationPackageSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().min(1),
  title: z.string().trim().max(200).default("Documentation pack"),
  status: DocumentationPackageStatusSchema.default("draft"),
  /** Main (or issuing) tip revision this pack seals. */
  design_revision_id: z.string().uuid().nullable().optional(),
  schedules: z.array(DocumentationScheduleSnapshotSchema).default([]),
  /** Optional Present document ids included at issue. */
  presentation_document_ids: z.array(z.string().uuid()).default([]),
  quote_total_incl_gst: z.number().nonnegative().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  issued_at: z.string().datetime().nullable().optional(),
});
export type DocumentationPackage = z.infer<typeof DocumentationPackageSchema>;

export const CreateDocumentationPackageInputSchema = z.object({
  title: z.string().trim().max(200).optional(),
  schedule_kinds: z
    .array(DocumentationScheduleKindSchema)
    .min(1)
    .default(["planting", "trench", "lighting", "material"]),
  presentation_document_ids: z.array(z.string().uuid()).optional(),
  design_revision_id: z.string().uuid().optional(),
});
export type CreateDocumentationPackageInput = z.infer<
  typeof CreateDocumentationPackageInputSchema
>;

export const IssueDocumentationPackageInputSchema = z.object({
  quote_total_incl_gst: z.number().nonnegative().nullable().optional(),
});
export type IssueDocumentationPackageInput = z.infer<
  typeof IssueDocumentationPackageInputSchema
>;

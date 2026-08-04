import { z } from "zod";

export const OutputKindSchema = z.enum([
  "task_list",
  "schedule",
  "quote",
  "brochure",
  "scope",
  "daily_site_report",
  "permit_stonnington_stormwater",
  "permit_yarra_heritage",
  "establishment_calendar",
  "handover_pack",
]);
export type OutputKind = z.infer<typeof OutputKindSchema>;

export const OutputSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  kind: OutputKindSchema,
  uri: z.string().url(),
  generated_at: z.string().datetime(),
});
export type Output = z.infer<typeof OutputSchema>;

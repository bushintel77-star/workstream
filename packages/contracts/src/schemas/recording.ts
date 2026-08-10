import { z } from "zod";

export const RecordingSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  audio_uri: z.string().url(),
  duration_s: z.number().nonnegative(),
  transcript: z.string().nullable(),
  transcription_confidence: z.number().min(0).max(1).nullable(),
  dil_consent: z.boolean().default(false),
});
export type Recording = z.infer<typeof RecordingSchema>;

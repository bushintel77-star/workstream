import { z } from "zod";
import { DesignAssistResponseSchema } from "./catalog";

export const VoiceIntentSourceSchema = z.enum([
  "mobile_recording",
  "push_to_talk",
  "typed",
]);
export type VoiceIntentSource = z.infer<typeof VoiceIntentSourceSchema>;

export const VoiceIntentKindSchema = z.enum(["design", "dictation"]);
export type VoiceIntentKind = z.infer<typeof VoiceIntentKindSchema>;

export const VoiceIntentRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(10_000),
  confidence: z.number().min(0).max(1),
  source: VoiceIntentSourceSchema.default("mobile_recording"),
  dil_consent: z.boolean(),
});
export type VoiceIntentRequest = z.infer<typeof VoiceIntentRequestSchema>;

export const VoiceIntentResponseSchema = z.object({
  kind: VoiceIntentKindSchema,
  transcript: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  reply: z.string(),
  design: DesignAssistResponseSchema.nullable(),
  events: z.array(z.unknown()),
  dil_recorded: z.literal(false),
});
export type VoiceIntentResponse = z.infer<typeof VoiceIntentResponseSchema>;

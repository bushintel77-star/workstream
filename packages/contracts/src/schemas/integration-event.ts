import { z } from "zod";

export const IntegrationChannelSchema = z.enum([
  "crm",
  "email",
  "stripe",
  "myob",
  "xero",
  "anthropic",
  "openai",
]);
export type IntegrationChannel = z.infer<typeof IntegrationChannelSchema>;

export const IntegrationEventTypeSchema = z.enum([
  "project.created",
  "quote.generated",
  "audit.passed",
  "deposit.paid",
  "manual.sync",
]);
export type IntegrationEventType = z.infer<typeof IntegrationEventTypeSchema>;

export const IntegrationEventSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  project_id: z.string().uuid().nullable(),
  event: IntegrationEventTypeSchema,
  channel: IntegrationChannelSchema,
  ok: z.boolean(),
  detail: z.string(),
  created_at: z.string().datetime(),
});
export type IntegrationEvent = z.infer<typeof IntegrationEventSchema>;

export const IntegrationNotifyInputSchema = z.object({
  to_email: z.string().email().optional(),
  client_name: z.string().min(1).max(200).optional(),
  include_portal: z.boolean().optional(),
});
export type IntegrationNotifyInput = z.infer<typeof IntegrationNotifyInputSchema>;

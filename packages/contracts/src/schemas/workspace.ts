import { z } from "zod";

export const WorkspacePlanSchema = z.enum(["lite", "studio"]);
export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;

export const WorkspaceBillingSchema = z.object({
  owner_id: z.string(),
  plan: WorkspacePlanSchema,
  seat_limit: z.number().int().positive().default(1),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  updated_at: z.string().datetime(),
});
export type WorkspaceBilling = z.infer<typeof WorkspaceBillingSchema>;

export const IntegrationSummarySchema = z.object({
  plan: WorkspacePlanSchema,
  seat_limit: z.number().int().positive(),
  live_channels: z.number().int().nonnegative(),
  total_channels: z.number().int().positive(),
  needs_attention: z.boolean(),
  next_steps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      href: z.string(),
      done: z.boolean(),
    }),
  ),
});
export type IntegrationSummary = z.infer<typeof IntegrationSummarySchema>;

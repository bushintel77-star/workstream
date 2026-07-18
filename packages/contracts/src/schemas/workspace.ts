import { z } from "zod";

export const WorkspacePlanSchema = z.enum(["lite", "studio"]);
export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;

/** Design & Build License — commercial product name for Studio. */
export const LICENSE_PRODUCT_NAME = "Design & Build License";

export const WorkspaceMemberRoleSchema = z.enum(["owner", "operator"]);
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;

export const WorkspaceMemberSchema = z.object({
  workspace_id: z.string(),
  user_id: z.string(),
  role: WorkspaceMemberRoleSchema,
  joined_at: z.string().datetime(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const WorkspaceBillingSchema = z.object({
  owner_id: z.string(),
  plan: WorkspacePlanSchema,
  seat_limit: z.number().int().positive().default(1),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  updated_at: z.string().datetime(),
});
export type WorkspaceBilling = z.infer<typeof WorkspaceBillingSchema>;

export const WorkspaceLicenseSchema = z.object({
  product_name: z.literal("Design & Build License"),
  plan: WorkspacePlanSchema,
  seat_limit: z.number().int().positive(),
  seats_used: z.number().int().nonnegative(),
  seats_available: z.number().int().nonnegative(),
  live_integrations: z.boolean(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  members: z.array(WorkspaceMemberSchema),
});
export type WorkspaceLicense = z.infer<typeof WorkspaceLicenseSchema>;

export const IntegrationSummarySchema = z.object({
  plan: WorkspacePlanSchema,
  seat_limit: z.number().int().positive(),
  seats_used: z.number().int().nonnegative().optional(),
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

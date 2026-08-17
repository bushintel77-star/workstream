import { z } from "zod";

/**
 * Project signoff — the persisted record that a design was issued at a
 * specific revision with the required liability notices accepted and the quote
 * total fixed. This is Screen 4's "signoff": a durable, auditable state, not a
 * checkbox ritual.
 *
 * Ground-truth rule: a signoff is only valid when it can point to the revision
 * it signed, the quote total it approved, and the notice ids the operator
 * accepted. Anything less stays `status: "pending"`.
 */
export const ProjectSignoffSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  /** pending until revision + quote + required notices are all present. */
  status: z.enum(["pending", "signed_off"]),
  /** Design revision the signoff is bound to (design-vcs revision id). */
  revision: z.string().nullable(),
  /** Notice ids the operator explicitly accepted for this issue. */
  accepted_notice_ids: z.array(z.string()).default([]),
  /** Quote total (AUD incl. GST) frozen at the moment of signoff. */
  quote_total_incl_gst: z.number().nonnegative(),
  signed_at: z.string().datetime().nullable(),
  signed_by: z.string().nullable(),
  updated_at: z.string().datetime(),
});
export type ProjectSignoff = z.infer<typeof ProjectSignoffSchema>;

/** Server-side upsert payload (id / timestamps are store-owned). */
export const UpsertProjectSignoffInputSchema = ProjectSignoffSchema.omit({
  id: true,
  project_id: true,
  updated_at: true,
});
export type UpsertProjectSignoffInput = z.infer<
  typeof UpsertProjectSignoffInputSchema
>;

/** Why a signoff is not yet ready — surfaced verbatim in the signoff card. */
export const SignoffMissingReasonSchema = z.enum([
  "revision",
  "quote",
  "notices",
]);
export type SignoffMissingReason = z.infer<typeof SignoffMissingReasonSchema>;

export const SignoffReadinessSchema = z.object({
  ready: z.boolean(),
  /** Already signed off — immutable; further edits need a new revision. */
  signed_off: z.boolean(),
  missing: z.array(SignoffMissingReasonSchema),
  /** Safety waiver that must be hard-confirmed before the share proceeds. */
  hard_confirm_notice_id: z.string().nullable(),
  soft_outstanding: z.number().int().nonnegative(),
});
export type SignoffReadiness = z.infer<typeof SignoffReadinessSchema>;

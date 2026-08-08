import { z } from "zod";
import { DesignCanvasSchema, UpsertDesignCanvasSchema } from "./catalog";

/**
 * Async design VCS — named branches over DesignCanvas tips.
 * See docs plan: landscape-ops + async design VCS (1A).
 * CadDocument is not branched; formalize from merged main only.
 */

export const DesignBranchStatusSchema = z.enum([
  "open",
  "merged",
  "abandoned",
]);
export type DesignBranchStatus = z.infer<typeof DesignBranchStatusSchema>;

/** Reserved name for the primary tip. */
export const MAIN_DESIGN_BRANCH_NAME = "main";

export const DesignRevisionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().min(1),
  branch_id: z.string().uuid(),
  /** Prior revision on this branch (null = genesis). */
  parent_id: z.string().uuid().nullable(),
  label: z.string().trim().max(80).optional(),
  message: z.string().trim().max(500).default(""),
  canvas: DesignCanvasSchema,
  created_at: z.string().datetime(),
  author_id: z.string().min(1),
});
export type DesignRevision = z.infer<typeof DesignRevisionSchema>;

export const DesignBranchSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  /** Revision this branch forked from (null for main genesis). */
  base_revision_id: z.string().uuid().nullable(),
  tip_revision_id: z.string().uuid(),
  status: DesignBranchStatusSchema.default("open"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type DesignBranch = z.infer<typeof DesignBranchSchema>;

export const CreateDesignBranchInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Fork from this revision; omit = current main tip. */
  from_revision_id: z.string().uuid().optional(),
});
export type CreateDesignBranchInput = z.infer<
  typeof CreateDesignBranchInputSchema
>;

export const CommitDesignBranchInputSchema = z.object({
  message: z.string().trim().max(500).optional(),
  canvas: UpsertDesignCanvasSchema,
});
export type CommitDesignBranchInput = z.infer<
  typeof CommitDesignBranchInputSchema
>;

export const MergeDesignBranchInputSchema = z.object({
  /** Target branch — defaults to main when omitted. */
  into_branch_id: z.string().uuid().optional(),
  /**
   * Conflict resolutions keyed by entity id.
   * ours = keep into-branch; theirs = take from feature; both = duplicate theirs with new id.
   */
  resolutions: z
    .record(z.enum(["ours", "theirs", "both"]))
    .optional()
    .default({}),
  message: z.string().trim().max(500).optional(),
});
export type MergeDesignBranchInput = z.infer<
  typeof MergeDesignBranchInputSchema
>;

export const DesignBranchCheckoutSchema = z.object({
  branch_id: z.string().uuid(),
});
export type DesignBranchCheckout = z.infer<typeof DesignBranchCheckoutSchema>;

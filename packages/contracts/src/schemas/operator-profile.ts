import { z } from "zod";

/**
 * Per-operator plant profile — the actual machines a crew runs, so the
 * machine-access band reflects their gear rather than generic thresholds.
 *
 * A machine's `min_access_width_mm` is the narrowest gap it can pass through.
 * `computeMachineAccess` picks the widest machine whose minimum fits the
 * computed side-corridor width; if none fits, the band is "barrow".
 *
 * Seeded for `dev-user` so the gate stays green without Clerk keys. A settings
 * surface to edit it is a separate UI task.
 */
export const OperatorPlantMachineSchema = z.object({
  id: z.string().min(1),
  /** Display name — e.g. "Kanga 7", "1.7 t mini loader", "Bobcat S70". */
  name: z.string().min(1),
  /**
   * Narrowest passable gap in millimetres. The machine needs at least this
   * much clearance between building and boundary to reach the rear.
   */
  min_access_width_mm: z.number().int().nonnegative(),
});
export type OperatorPlantMachine = z.infer<typeof OperatorPlantMachineSchema>;

export const OperatorPlantProfileSchema = z.object({
  owner_id: z.string().min(1),
  machines: z.array(OperatorPlantMachineSchema).default([]),
  updated_at: z.string().datetime(),
});
export type OperatorPlantProfile = z.infer<typeof OperatorPlantProfileSchema>;

export type OperatorPlantProfileInput = Omit<
  OperatorPlantProfile,
  "owner_id" | "updated_at"
>;

/**
 * Default plant profile — the spec's shape, used as the seed for `dev-user`
 * and as the fallback when an operator has not configured their machines.
 * Thresholds: <800 mm barrow only, 800–1200 mm mini loader/dingo, >1200 mm
 * standard bobcat. Verify against Curtis & Co's actual plant before fixing.
 */
export const DEFAULT_PLANT_MACHINES: OperatorPlantMachine[] = [
  { id: "barrow", name: "Wheelbarrow only", min_access_width_mm: 0 },
  { id: "mini-loader", name: "Mini loader / dingo", min_access_width_mm: 800 },
  { id: "bobcat", name: "Standard bobcat", min_access_width_mm: 1200 },
];

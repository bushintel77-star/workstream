import { z } from "zod";

/** Cross-job leftover material stock (PDF §4.6). */
export const LeftoverStockSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  sku: z.string().min(1),
  label: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().default("t"),
  source_project_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});
export type LeftoverStock = z.infer<typeof LeftoverStockSchema>;

export const RegisterLeftoverInputSchema = z.object({
  order_qty: z.number().positive(),
  used_qty: z.number().nonnegative(),
  sku: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().default("t"),
  source_project_id: z.string().uuid().optional(),
});
export type RegisterLeftoverInput = z.infer<typeof RegisterLeftoverInputSchema>;

export const ListLeftoversResponseSchema = z.object({
  leftovers: z.array(LeftoverStockSchema),
});
export type ListLeftoversResponse = z.infer<typeof ListLeftoversResponseSchema>;

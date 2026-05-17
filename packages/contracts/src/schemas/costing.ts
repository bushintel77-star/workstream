import { z } from "zod";

export const CostScenarioSchema = z.enum(["lean", "standard", "buffer"]);
export type CostScenario = z.infer<typeof CostScenarioSchema>;

export const LineItemSchema = z.object({
  sku: z.string(),
  label: z.string(),
  unit: z.string(),
  qty: z.number().positive(),
  rate: z.number().nonnegative(),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
  is_provisional: z.boolean().default(false),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const CostingSchema = z.object({
  id: z.string().uuid(),
  design_id: z.string().uuid(),
  scenario: CostScenarioSchema,
  line_items: z.array(LineItemSchema),
  subtotal: z.number().nonnegative(),
  gst: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type Costing = z.infer<typeof CostingSchema>;

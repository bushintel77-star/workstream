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
  /**
   * Non-costed written assumptions surfaced on the quote — e.g. machine
   * access width, derived-level provenance. These protect margin: a site that
   * contradicts a stated assumption is a documented variation, not an argument.
   * Renders in a dedicated block on the portal, separate from line items.
   * Optional — absent on legacy costings.
   */
  assumptions: z.array(z.string()).optional(),
});
export type Costing = z.infer<typeof CostingSchema>;

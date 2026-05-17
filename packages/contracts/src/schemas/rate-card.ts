import { z } from "zod";

export const RateCardSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  category: z.string(),
  sku: z.string(),
  label: z.string(),
  unit: z.string(),
  rate: z.number().nonnegative(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  effective_from: z.string().datetime(),
});
export type RateCard = z.infer<typeof RateCardSchema>;

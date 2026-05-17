import { z } from "zod";

export const PlantPaletteSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  species: z.string(),
  common_name: z.string(),
  mature_h_m: z.number().positive(),
  mature_w_m: z.number().positive(),
  category: z.string(),
  form: z.string().optional(),
  use_description: z.string(),
  climate_zones: z.array(z.string()),
  notes: z.string().optional(),
  curtis_approved: z.boolean().default(true),
});
export type PlantPalette = z.infer<typeof PlantPaletteSchema>;

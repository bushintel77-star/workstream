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

  // --- Professional nursery / landscape fields ---
  // Populated in the seed library from open botanical data (VicFlora / APC)
  // + Victorian nursery practice. All optional — the schedule generator falls
  // back to form-based defaults when a species record predates a field.
  /** Recommended on-centre spacing (m) — drives auto plant-schedule rows. */
  spacing_m: z.number().positive().optional(),
  /** Nursery container size (L) — drives the order-row pot column. */
  pot_size_l: z.number().positive().optional(),
  /** Sun exposure preference. */
  sun_exposure: z
    .enum(["full_sun", "part_shade", "full_shade", "full_sun_part_shade"])
    .optional(),
  /** Irrigation demand band (Melbourne dry-summer context). */
  water_needs: z.enum(["low", "moderate", "high"]).optional(),
  growth_rate: z.enum(["slow", "moderate", "fast"]).optional(),
  evergreen: z.boolean().optional(),
  /** Australian native (provenance: APC / VicFlora). */
  native: z.boolean().optional(),
  drought_tolerant: z.boolean().optional(),
  /** Flowering season, e.g. "spring", "summer–autumn". */
  flowering: z.string().optional(),
  /** Frost / hardiness note, e.g. "frost hardy", "light frost". */
  hardiness: z.string().optional(),
});
export type PlantPalette = z.infer<typeof PlantPaletteSchema>;

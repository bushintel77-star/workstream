import { z } from "zod";
import { CatalogCategorySchema } from "./catalog";

/** Operator-uploaded SVG asset (extends the built-in Curtis library). */
export const CreateCatalogSymbolSchema = z.object({
  label: z.string().min(1).max(80),
  category: CatalogCategorySchema,
  path_d: z
    .string()
    .min(8)
    .max(4000)
    .refine((d) => /^[Mm]/.test(d.trim()), "path_d must start with M or m"),
  description: z.string().max(200).optional(),
  rate_card_sku: z.string().max(32).optional(),
  preview_bg: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional(),
});
export type CreateCatalogSymbolInput = z.infer<typeof CreateCatalogSymbolSchema>;

export const CustomCatalogSymbolSchema = z.object({
  owner_id: z.string(),
  id: z.string(),
  label: z.string(),
  category: CatalogCategorySchema,
  path_d: z.string(),
  asset: z
    .object({
      view_box: z.string(),
      layers: z.array(
        z.object({
          d: z.string(),
          fill: z.string().optional(),
          stroke: z.string().optional(),
          stroke_width: z.number().optional(),
        }),
      ),
      preview_bg: z.string().optional(),
      accent: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  default_width_m: z.number().positive().optional(),
  rate_card_sku: z.string().optional(),
});
export type CustomCatalogSymbol = z.infer<typeof CustomCatalogSymbolSchema>;

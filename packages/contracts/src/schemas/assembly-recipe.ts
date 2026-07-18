import { z } from "zod";

export const AssemblyLayerRoleSchema = z.enum([
  "surface",
  "bedding",
  "base",
  "excavation",
]);
export type AssemblyLayerRole = z.infer<typeof AssemblyLayerRoleSchema>;

export const AssemblyLayerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  depth_m: z.number().nonnegative(),
  sku: z.string().nullable().optional(),
  role: AssemblyLayerRoleSchema,
});
export type AssemblyLayer = z.infer<typeof AssemblyLayerSchema>;

export const AssemblyRecipeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  layers: z.array(AssemblyLayerSchema).min(1),
});
export type AssemblyRecipe = z.infer<typeof AssemblyRecipeSchema>;

/** Standard paving build-up: 50 mm surface + 30 mm bedding + 100 mm base. */
export const DEFAULT_PAVING_ASSEMBLY: AssemblyRecipe = {
  id: "default-paving",
  label: "Default paving assembly",
  layers: [
    {
      id: "pav-surface",
      label: "Surface",
      depth_m: 0.05,
      sku: null,
      role: "surface",
    },
    {
      id: "pav-bedding",
      label: "Bedding",
      depth_m: 0.03,
      sku: null,
      role: "bedding",
    },
    {
      id: "pav-base",
      label: "Base",
      depth_m: 0.1,
      sku: null,
      role: "base",
    },
  ],
};

/** Sum of all layer depths (metres). */
export function totalDepthM(recipe: AssemblyRecipe): number {
  return recipe.layers.reduce((sum, layer) => sum + layer.depth_m, 0);
}

/** Depth for the first layer matching `role`, or 0 when absent. */
export function layerDepthM(
  recipe: AssemblyRecipe,
  role: AssemblyLayerRole,
): number {
  return recipe.layers.find((layer) => layer.role === role)?.depth_m ?? 0;
}

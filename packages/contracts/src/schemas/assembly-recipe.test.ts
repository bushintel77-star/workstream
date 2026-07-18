import { describe, expect, it } from "vitest";
import {
  AssemblyRecipeSchema,
  DEFAULT_PAVING_ASSEMBLY,
  layerDepthM,
  totalDepthM,
} from "./assembly-recipe";

describe("AssemblyRecipe", () => {
  it("parses default paving assembly", () => {
    const recipe = AssemblyRecipeSchema.parse(DEFAULT_PAVING_ASSEMBLY);
    expect(recipe.layers).toHaveLength(3);
    expect(totalDepthM(recipe)).toBeCloseTo(0.18, 5);
    expect(layerDepthM(recipe, "surface")).toBe(0.05);
    expect(layerDepthM(recipe, "bedding")).toBe(0.03);
    expect(layerDepthM(recipe, "base")).toBe(0.1);
  });
});

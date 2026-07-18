import { describe, expect, it } from "vitest";
import {
  jitterPlacement,
  mulberry32,
  pushSwatchHistory,
  recipeFromPlacement,
} from "./brush-recipe";

describe("brush recipe", () => {
  it("builds recipe from placement", () => {
    const r = recipeFromPlacement(
      {
        id: "00000000-0000-4000-8000-000000000001",
        symbol_id: "bluestone-paver",
        x_pct: 40,
        y_pct: 50,
        rotation_deg: 12,
        scale: 1.2,
      },
      { id: "bluestone-paver", label: "Bluestone", category: "paving", path_d: "M0 0" } as never,
      () => "recipe-1",
    );
    expect(r.symbol_id).toBe("bluestone-paver");
    expect(r.scale).toBe(1.2);
    expect(r.copy_pricing).toBe(true);
  });

  it("keeps 5 MRU swatch slots", () => {
    let hist: ReturnType<typeof recipeFromPlacement>[] = [];
    for (let i = 0; i < 7; i++) {
      hist = pushSwatchHistory(hist, {
        id: `r${i}`,
        symbol_id: `sym-${i}`,
        scale: 1,
        rotation_deg: 0,
        copy_geometry: true,
        copy_material: true,
        copy_pricing: true,
      });
    }
    expect(hist).toHaveLength(5);
    expect(hist[0]!.symbol_id).toBe("sym-6");
  });

  it("jitters within bounds", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const j = jitterPlacement({ scale: 1, rotation_deg: 0 }, rng);
      expect(j.scale).toBeGreaterThanOrEqual(0.35);
      expect(j.scale).toBeLessThanOrEqual(4);
    }
  });

  it("seed rng is deterministic", () => {
    const a = mulberry32(99)();
    const b = mulberry32(99)();
    expect(a).toBe(b);
  });
});

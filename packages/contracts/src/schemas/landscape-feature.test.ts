import { describe, expect, it } from "vitest";
import { BrushRecipeSchema, LandscapeFeatureSchema } from "./landscape-feature";

describe("LandscapeFeature schema", () => {
  it("parses hybrid pct + material cache (AU metric)", () => {
    const feature = LandscapeFeatureSchema.parse({
      id: "bed-1",
      type: "LandscapeFeature",
      metadata: {
        layer: "softscape_beds",
        friendly_name: "Front bed",
        timestamp_created: "2026-07-17T00:00:00.000Z",
        source_attribution: "human_drawn",
        user_modification_state: "draft",
      },
      geometry: {
        type: "Polygon",
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 10, y_pct: 20 },
        points: [
          {
            id: "v1",
            pct: { x_pct: 10, y_pct: 20 },
            geodetic: { lng: 144.96, lat: -37.81 },
          },
          { id: "v2", pct: { x_pct: 30, y_pct: 20 } },
          { id: "v3", pct: { x_pct: 30, y_pct: 40 } },
        ],
      },
      material_fill: {
        type: "volumetric_surface",
        sku: "mulch-premium",
        depth_m: 0.075,
        waste_allocation_pct: 10,
        live_calculations: {
          area_m2: 12.5,
          volume_m3: 1.03,
          cost_aud: 186.4,
        },
      },
      procedural_scatter_contents: {
        brush_recipe_id: "recipe-1",
        seed_value: 42,
        instances: [],
      },
      labor_profile: {
        base_difficulty_tier: "standard_soil",
        estimated_install_hours: 2.5,
        calculated_labor_cost_aud: 187.5,
      },
    });
    expect(feature.material_fill?.live_calculations?.cost_aud).toBe(186.4);
    expect(feature.metadata.source_attribution).toBe("human_drawn");
  });

  it("parses BrushRecipe", () => {
    const r = BrushRecipeSchema.parse({
      id: "r1",
      symbol_id: "bluestone-paver",
      scale: 1.1,
      rotation_deg: 15,
      copy_geometry: true,
      copy_material: true,
      copy_pricing: false,
    });
    expect(r.copy_pricing).toBe(false);
  });
});

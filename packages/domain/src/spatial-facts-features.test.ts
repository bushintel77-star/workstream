import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { spatialFactsFromCanvas } from "./spatial-facts";

describe("spatialFactsFromCanvas features", () => {
  it("emits spatial objects for structured landscape features", () => {
    const canvas: DesignCanvas = {
      id: "00000000-0000-4000-8000-000000000099",
      project_id: "00000000-0000-4000-8000-000000000001",
      placements: [],
      strokes: [],
      irrigation_zones: [],
      annotations: [],
      features: [
        {
          id: "feat-1",
          type: "LandscapeFeature",
          metadata: {
            layer: "hardscape",
            friendly_name: "Path (1.2 m × 0.075 m)",
            timestamp_created: "2026-08-09T00:00:00.000Z",
            source_attribution: "human_drawn",
            user_modification_state: "draft",
          },
          geometry: {
            type: "LineString",
            spatial_reference: "EPSG:3857",
            canvas_origin_pct: { x_pct: 0, y_pct: 0 },
            points: [
              { id: "a", pct: { x_pct: 10, y_pct: 20 } },
              { id: "b", pct: { x_pct: 40, y_pct: 20 } },
            ],
          },
          material_fill: {
            type: "surface",
            sku: "PAVE-BLUESTONE",
            depth_m: 0.075,
            waste_allocation_pct: 10,
          },
        },
      ],
      updated_at: "2026-08-09T00:00:00.000Z",
    };
    const facts = spatialFactsFromCanvas(canvas, []);
    expect(facts.some((f) => f.id === "feature:feat-1")).toBe(true);
    expect(facts[0]!.length_m).toBeGreaterThan(0);
  });
});

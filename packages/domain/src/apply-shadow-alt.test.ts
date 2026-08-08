import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { applyShadowAlternative } from "./apply-shadow-alt";

function canvas(partial: Partial<DesignCanvas>): DesignCanvas {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    project_id: "00000000-0000-4000-8000-000000000001",
    placements: [],
    strokes: [],
    irrigation_zones: [],
    annotations: [],
    features: [],
    updated_at: "2026-08-09T00:00:00.000Z",
    ...partial,
  };
}

describe("applyShadowAlternative", () => {
  it("swaps lighting to solar", () => {
    const res = applyShadowAlternative(
      canvas({
        placements: [
          {
            id: "p1",
            symbol_id: "path-light",
            x_pct: 20,
            y_pct: 30,
            rotation_deg: 0,
            scale: 1,
            label: "Path light",
          },
        ],
      }),
      "alt-solar-lighting",
    );
    expect(res.canvas.placements[0]!.symbol_id).toBe("path-light-solar");
  });

  it("nudges hardscape away from trees", () => {
    const res = applyShadowAlternative(
      canvas({
        placements: [
          {
            id: "t1",
            symbol_id: "tree-canopy",
            x_pct: 40,
            y_pct: 40,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "h1",
            symbol_id: "paving",
            x_pct: 42,
            y_pct: 40,
            rotation_deg: 0,
            scale: 1,
          },
        ],
      }),
      "alt-setback-geometry",
    );
    expect(res.canvas.placements[1]!.x_pct).toBeGreaterThan(42);
  });
});

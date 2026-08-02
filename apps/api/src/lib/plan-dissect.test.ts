import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { dissectPlan, canvasRevisionOf } from "./plan-dissect";

function makeCanvas(overrides: Partial<DesignCanvas> = {}): DesignCanvas {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    project_id: "00000000-0000-0000-0000-000000000002",
    placements: [],
    strokes: [],
    irrigation_zones: [],
    construction_trenches: [],
    annotations: [],
    image_layers: [],
    features: [],
    updated_at: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("dissectPlan", () => {
  it("always produces an overview panel", () => {
    const result = dissectPlan(makeCanvas());
    const overviews = result.ghosts.filter((g) => g.reason === "overview");
    expect(overviews).toHaveLength(1);
    expect(overviews[0]!.crop).toEqual({
      x_pct: 0,
      y_pct: 0,
      w_pct: 100,
      h_pct: 100,
    });
    expect(overviews[0]!.label).toBe("Site plan overview");
  });

  it("returns a canvas_revision derived from updated_at", () => {
    const result = dissectPlan(makeCanvas());
    expect(result.canvas_revision).toBe(
      new Date("2026-01-15T10:00:00.000Z").getTime(),
    );
  });

  it("does not produce aspect quadrants without north_bearing", () => {
    const result = dissectPlan(makeCanvas());
    const aspects = result.ghosts.filter((g) => g.reason === "aspect");
    expect(aspects).toHaveLength(0);
  });

  it("produces 4 aspect quadrants when north_bearing is calibrated", () => {
    const result = dissectPlan(
      makeCanvas({
        site_frame: {
          boundary: [],
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
          north_bearing: 0,
        },
      }),
    );
    const aspects = result.ghosts.filter((g) => g.reason === "aspect");
    expect(aspects).toHaveLength(4);
    // Bearing 0: board-up = N. TL = NW → North, TR = NE → North
    // Actually: TL dir = 315 → North, TR dir = 45 → North
    // BL dir = 225 → West, BR dir = 135 → South
    // Wait — let me re-check: 315 is in [315,360) → North. 45 is in [45,135) → East.
    // So TL = North, TR = East, BL = West, BR = South
    const labels = aspects.map((a) => a.label).sort();
    expect(labels).toEqual(
      ["East aspect", "North aspect", "South aspect", "West aspect"].sort(),
    );
  });

  it("each aspect quadrant is a 50x50 crop", () => {
    const result = dissectPlan(
      makeCanvas({
        site_frame: {
          boundary: [],
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
          north_bearing: 90,
        },
      }),
    );
    const aspects = result.ghosts.filter((g) => g.reason === "aspect");
    for (const a of aspects) {
      expect(a.crop.w_pct).toBe(50);
      expect(a.crop.h_pct).toBe(50);
    }
  });

  it("does not produce feature clusters with fewer than 4 placements", () => {
    const result = dissectPlan(
      makeCanvas({
        placements: [
          {
            id: "00000000-0000-0000-0000-000000000011",
            symbol_id: "tree-canopy",
            x_pct: 20,
            y_pct: 20,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "00000000-0000-0000-0000-000000000012",
            symbol_id: "tree-canopy",
            x_pct: 30,
            y_pct: 30,
            rotation_deg: 0,
            scale: 1,
          },
        ],
      }),
    );
    const features = result.ghosts.filter((g) => g.reason === "feature");
    expect(features).toHaveLength(0);
  });

  it("produces feature clusters with 4+ placements in proximity", () => {
    const result = dissectPlan(
      makeCanvas({
        placements: [
          {
            id: "00000000-0000-0000-0000-000000000011",
            symbol_id: "hedge-lomandra",
            x_pct: 20,
            y_pct: 20,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "00000000-0000-0000-0000-000000000012",
            symbol_id: "hedge-lomandra",
            x_pct: 25,
            y_pct: 25,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "00000000-0000-0000-0000-000000000013",
            symbol_id: "paving-bluestone",
            x_pct: 22,
            y_pct: 22,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "00000000-0000-0000-0000-000000000014",
            symbol_id: "paving-bluestone",
            x_pct: 28,
            y_pct: 28,
            rotation_deg: 0,
            scale: 1,
          },
        ],
      }),
    );
    const features = result.ghosts.filter((g) => g.reason === "feature");
    expect(features.length).toBeGreaterThanOrEqual(1);
    expect(features[0]!.label).toMatch(/area$/);
  });

  it("produces all three cut families when conditions are met", () => {
    const result = dissectPlan(
      makeCanvas({
        placements: Array.from({ length: 6 }, (_, i) => ({
          id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
          symbol_id: "tree-canopy",
          x_pct: 30 + (i % 3) * 5,
          y_pct: 30 + Math.floor(i / 3) * 5,
          rotation_deg: 0,
          scale: 1,
        })),
        site_frame: {
          boundary: [],
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
          north_bearing: 180,
        },
      }),
    );
    const reasons = new Set(result.ghosts.map((g) => g.reason));
    expect(reasons.has("overview")).toBe(true);
    expect(reasons.has("aspect")).toBe(true);
    expect(reasons.has("feature")).toBe(true);
  });

  it("canvasRevisionOf is a stable positive integer", () => {
    const rev = canvasRevisionOf(makeCanvas());
    expect(rev).toBeGreaterThan(0);
    expect(Number.isInteger(rev)).toBe(true);
  });
});

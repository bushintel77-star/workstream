import { describe, expect, it } from "vitest";
import type { CadDocument, DesignCanvas } from "@workstream/contracts";
import { DEFAULT_CAD_LAYERS } from "./defaults";
import { stampSiteFrameToCad } from "./stamp-site-frame";

function blankDoc(width_m: number, height_m: number): CadDocument {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    project_id: "22222222-2222-2222-2222-222222222222",
    version: 1,
    units: "m",
    origin: { x: 0, y: 0 },
    width_m,
    height_m,
    layers: DEFAULT_CAD_LAYERS.map((l) => ({ ...l })),
    entities: [],
    blocks: [],
    ai_run_id: null,
    source_sketch_id: null,
    updated_at: new Date().toISOString(),
  };
}

function canvasWithFrame(
  frame: NonNullable<DesignCanvas["site_frame"]>,
): DesignCanvas {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    project_id: "22222222-2222-2222-2222-222222222222",
    placements: [],
    strokes: [],
    irrigation_zones: [],
    construction_trenches: [],
    annotations: [],
    image_layers: [],
    features: [],
    site_frame: frame,
    updated_at: new Date().toISOString(),
  };
}

const emptyFrame = {
  boundary: [] as Array<{ x_pct: number; y_pct: number }>,
  building: [] as Array<{ x_pct: number; y_pct: number }>,
  easements: [] as Array<Array<{ x_pct: number; y_pct: number }>>,
  services: [] as Array<Array<{ x_pct: number; y_pct: number }>>,
  levels: [] as Array<{ x_pct: number; y_pct: number; z_m: number }>,
  drainage_runs: [] as NonNullable<
    DesignCanvas["site_frame"]
  >["drainage_runs"],
  byda_assets: [] as NonNullable<DesignCanvas["site_frame"]>["byda_assets"],
  keyless_overlays: [] as NonNullable<
    DesignCanvas["site_frame"]
  >["keyless_overlays"],
};

describe("stampSiteFrameToCad", () => {
  it("stamps boundary and building onto STRUCTURES", () => {
    const next = stampSiteFrameToCad(
      blankDoc(40, 30),
      canvasWithFrame({
        ...emptyFrame,
        boundary: [
          { x_pct: 10, y_pct: 10 },
          { x_pct: 90, y_pct: 10 },
          { x_pct: 90, y_pct: 90 },
          { x_pct: 10, y_pct: 90 },
        ],
        building: [
          { x_pct: 30, y_pct: 20 },
          { x_pct: 70, y_pct: 20 },
          { x_pct: 70, y_pct: 50 },
          { x_pct: 30, y_pct: 50 },
        ],
      }),
    );
    const structures = next.entities.filter(
      (e) => e.kind === "polyline" && e.layer === "STRUCTURES",
    );
    expect(structures).toHaveLength(2);
    const first = structures[0]!;
    expect(first.kind).toBe("polyline");
    if (first.kind === "polyline") {
      expect(first.closed).toBe(true);
      // y_pct 10 → high Y (Y-up): (100-10)/100 * 30 = 27
      expect(first.points[0]!.y).toBeCloseTo(27, 5);
    }
    expect(
      next.entities.some(
        (e) =>
          e.kind === "text" && e.value.includes("Working plan metres"),
      ),
    ).toBe(true);
  });

  it("stamps easements onto SERVICES", () => {
    const next = stampSiteFrameToCad(
      blankDoc(20, 20),
      canvasWithFrame({
        ...emptyFrame,
        easements: [
          [
            { x_pct: 0, y_pct: 50 },
            { x_pct: 100, y_pct: 50 },
          ],
        ],
      }),
    );
    const services = next.entities.filter(
      (e) => e.kind === "polyline" && e.layer === "SERVICES",
    );
    expect(services).toHaveLength(1);
    const run = services[0]!;
    expect(run.kind).toBe("polyline");
    if (run.kind === "polyline") {
      expect(run.points).toHaveLength(2);
    }
  });

  it("no-ops when site_frame is absent", () => {
    expect(stampSiteFrameToCad(blankDoc(20, 20), null).entities).toHaveLength(
      0,
    );
  });
});

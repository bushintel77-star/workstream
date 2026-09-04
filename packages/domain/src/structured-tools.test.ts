import { describe, expect, it } from "vitest";
import { LandscapeFeatureSchema } from "@workstream/contracts";
import {
  buildLandscapeFeatureFromStroke,
  defaultStructuredToolProps,
} from "./structured-tools";

describe("structured-tools", () => {
  it("defaults ditch width/depth", () => {
    const d = defaultStructuredToolProps("ditch");
    expect(d.width_m).toBe(0.3);
    expect(d.depth_m).toBe(0.45);
  });

  it("builds LineString wall and closed Polygon bed", () => {
    const wall = buildLandscapeFeatureFromStroke({
      kind: "wall",
      id: "feat-wall",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 20 },
        { x_pct: 40, y_pct: 22 },
      ],
    });
    expect(wall.geometry.type).toBe("LineString");
    expect(wall.material_fill?.sku).toBe("WALL-BLOCK");

    const bed = buildLandscapeFeatureFromStroke({
      kind: "bed",
      id: "feat-bed",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 30, y_pct: 10 },
        { x_pct: 30, y_pct: 30 },
      ],
    });
    expect(bed.geometry.type).toBe("Polygon");
    expect(bed.geometry.points.length).toBe(4);
  });

  it("clamps off-board ink so the feature validates against the contract", () => {
    // Ink drawn on the context ground either side of the board is legal —
    // `worldToPct` returns < 0 and > 100 there — but feature vertices are
    // board-bounded. Unclamped, the whole-canvas autosave PUT is rejected
    // with "Number must be greater than or equal to 0" forever.
    const path = buildLandscapeFeatureFromStroke({
      kind: "path",
      id: "feat-offboard-path",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: -194.37, y_pct: -12.5 },
        { x_pct: 42.5, y_pct: 61.25 },
        { x_pct: 137.82, y_pct: 168.04 },
      ],
    });

    for (const v of path.geometry.points) {
      expect(v.pct.x_pct).toBeGreaterThanOrEqual(0);
      expect(v.pct.x_pct).toBeLessThanOrEqual(100);
      expect(v.pct.y_pct).toBeGreaterThanOrEqual(0);
      expect(v.pct.y_pct).toBeLessThanOrEqual(100);
    }
    expect(LandscapeFeatureSchema.safeParse(path).success).toBe(true);
  });

  it("closes an off-board bed loop on the clamped ring", () => {
    const bed = buildLandscapeFeatureFromStroke({
      kind: "bed",
      id: "feat-offboard-bed",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: -30, y_pct: -30 },
        { x_pct: 130, y_pct: -30 },
        { x_pct: 130, y_pct: 130 },
      ],
    });

    expect(bed.geometry.points.map((v) => v.pct)).toEqual([
      { x_pct: 0, y_pct: 0 },
      { x_pct: 100, y_pct: 0 },
      { x_pct: 100, y_pct: 100 },
      { x_pct: 0, y_pct: 0 },
    ]);
    expect(LandscapeFeatureSchema.safeParse(bed).success).toBe(true);
  });

  it("injects extrude_height_m when planeZ is provided", () => {
    const wall = buildLandscapeFeatureFromStroke({
      kind: "wall",
      id: "feat-wall-massing",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 20 },
        { x_pct: 40, y_pct: 22 },
      ],
      planeZ: 4.0,
    });
    expect(wall.extrude_height_m).toBe(4.0);
    expect(LandscapeFeatureSchema.safeParse(wall).success).toBe(true);
  });

  it("injects planting Z for beds", () => {
    const bed = buildLandscapeFeatureFromStroke({
      kind: "bed",
      id: "feat-bed-planting",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 30, y_pct: 10 },
        { x_pct: 30, y_pct: 30 },
      ],
      planeZ: 1.5,
    });
    expect(bed.extrude_height_m).toBe(1.5);
    expect(LandscapeFeatureSchema.safeParse(bed).success).toBe(true);
  });

  it("omits extrude_height_m when planeZ is absent (backward-compatible)", () => {
    const path = buildLandscapeFeatureFromStroke({
      kind: "path",
      id: "feat-path-ground",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 20 },
        { x_pct: 40, y_pct: 22 },
      ],
    });
    expect(path.extrude_height_m).toBeUndefined();
  });

  it("omits extrude_height_m when planeZ is 0 (ground plane)", () => {
    const ditch = buildLandscapeFeatureFromStroke({
      kind: "ditch",
      id: "feat-ditch-ground",
      now: "2026-08-09T00:00:00.000Z",
      points: [
        { x_pct: 10, y_pct: 20 },
        { x_pct: 40, y_pct: 22 },
      ],
      planeZ: 0,
    });
    expect(ditch.extrude_height_m).toBeUndefined();
  });
});

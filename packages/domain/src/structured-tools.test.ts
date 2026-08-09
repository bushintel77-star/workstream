import { describe, expect, it } from "vitest";
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
});

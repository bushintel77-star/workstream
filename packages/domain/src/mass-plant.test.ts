import { describe, expect, it } from "vitest";
import {
  generateStaggeredPlacements,
  massPlantSummary,
  staggeredPlantCount,
} from "./mass-plant";
import { polygonAreaFromCanvasPercent } from "./canvas-geometry";

const scale = {
  metresPerXPx: 0.05,
  metresPerYPx: 0.05,
  canvasWidthPx: 400,
  canvasHeightPx: 280,
};

describe("mass-plant", () => {
  it("counts staggered plants for a bed area", () => {
    expect(staggeredPlantCount(10, 45)).toBeGreaterThan(0);
    expect(staggeredPlantCount(0, 45)).toBe(0);
  });

  it("summarises square bed area and plant count", () => {
    const bed = [
      { x_pct: 10, y_pct: 10 },
      { x_pct: 40, y_pct: 10 },
      { x_pct: 40, y_pct: 40 },
      { x_pct: 10, y_pct: 40 },
    ];
    const summary = massPlantSummary(bed, 45, scale);
    expect(summary.areaM2).toBeGreaterThan(0);
    expect(summary.plantCount).toBeGreaterThan(0);
    expect(summary.plantCount).toBe(staggeredPlantCount(summary.areaM2, 45));
  });

  it("fills a square polygon with staggered placements", () => {
    const bed = [
      { x_pct: 20, y_pct: 20 },
      { x_pct: 50, y_pct: 20 },
      { x_pct: 50, y_pct: 50 },
      { x_pct: 20, y_pct: 50 },
    ];
    const area = polygonAreaFromCanvasPercent(bed, scale);
    const placements = generateStaggeredPlacements(
      bed,
      "lomandra-mass",
      45,
      scale,
      () => "test-id",
    );
    expect(placements.length).toBeGreaterThan(0);
    expect(placements.every((p) => p.symbol_id === "lomandra-mass")).toBe(true);
    expect(placements.length).toBeLessThanOrEqual(
      staggeredPlantCount(area, 45) + 5,
    );
  });
});

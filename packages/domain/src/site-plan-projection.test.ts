import { describe, expect, it } from "vitest";
import {
  fitSurveyToPercentView,
  gardenPolygonToSvgPath,
  ringToSvgPoints,
  type SitePlanSurveyLike,
} from "./site-plan-projection";

const mockSurvey = (): SitePlanSurveyLike => ({
  title_polygon: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0.001, 0],
        [0.001, 0.0008],
        [0, 0.0008],
        [0, 0],
      ],
    ],
  },
  house_polygon: {
    type: "Polygon",
    coordinates: [
      [
        [0.0002, 0.0002],
        [0.0008, 0.0002],
        [0.0008, 0.0006],
        [0.0002, 0.0006],
        [0.0002, 0.0002],
      ],
    ],
  },
  garden_polygon: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0.001, 0],
        [0.001, 0.0008],
        [0, 0.0008],
        [0, 0],
      ],
      [
        [0.0002, 0.0002],
        [0.0008, 0.0002],
        [0.0008, 0.0006],
        [0.0002, 0.0006],
        [0.0002, 0.0002],
      ],
    ],
  },
  lot_area_m2: 400,
  house_area_m2: 120,
  garden_area_m2: 280,
});

describe("site-plan-projection", () => {
  it("projects lot ring into percent viewbox", () => {
    const project = fitSurveyToPercentView(mockSurvey(), 5);
    const pts = ringToSvgPoints(
      mockSurvey().title_polygon.coordinates[0]!,
      project,
    );
    expect(pts).toMatch(/\d+(\.\d+)?,\d+(\.\d+)?/);
    const nums = pts.split(" ").flatMap((p) => p.split(",").map(Number));
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it("builds garden path with hole for house", () => {
    const project = fitSurveyToPercentView(mockSurvey(), 5);
    const path = gardenPolygonToSvgPath(mockSurvey().garden_polygon, project);
    expect(path).toContain("M ");
    expect(path).toContain("Z");
    expect(path.split("M").length).toBeGreaterThanOrEqual(3);
  });
});

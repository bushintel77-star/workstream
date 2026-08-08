import { describe, expect, it } from "vitest";
import { estimateStudioDrawing } from "./studio-preemptive-estimate";
import {
  BULKAGE_EXCAVATED_CLAY,
  BULKAGE_TOPSOIL,
  buildIsolithSurvey,
  isolithRingRadii,
} from "./volumetric-isolith";

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

describe("buildIsolithSurvey", () => {
  it("derives topsoil, crushed rock, and excavated clay from paving estimate", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 1.5,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const survey = buildIsolithSurvey(report);
    expect(survey.materials.length).toBeGreaterThanOrEqual(2);
    const clay = survey.materials.find((m) => m.kind === "excavated_clay");
    const top = survey.materials.find((m) => m.kind === "topsoil");
    const cr = survey.materials.find((m) => m.kind === "crushed_rock");
    expect(clay).toBeTruthy();
    expect(top).toBeTruthy();
    expect(cr).toBeTruthy();
    expect(clay!.bulkageFactor).toBe(BULKAGE_EXCAVATED_CLAY);
    expect(top!.bulkageFactor).toBe(BULKAGE_TOPSOIL);
    expect(clay!.looseM3).toBeCloseTo(
      clay!.bankM3 * BULKAGE_EXCAVATED_CLAY,
      1,
    );
    expect(survey.primaryKind).toBe("excavated_clay");
    expect(survey.totalLooseM3).toBeGreaterThan(0);
  });

  it("returns empty materials when no hardscape", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "c1",
          t: "canopy",
          x: 40,
          y: 40,
          scale: 1,
        },
      ],
    });
    const survey = buildIsolithSurvey(report);
    expect(survey.materials).toHaveLength(0);
    expect(survey.primaryKind).toBeNull();
  });
});

describe("isolithRingRadii", () => {
  it("adds rings and tightens as intensity rises", () => {
    const sparse = isolithRingRadii(0.1);
    const dense = isolithRingRadii(0.95);
    expect(dense.length).toBeGreaterThanOrEqual(sparse.length);
    expect(sparse[0]).toBeGreaterThan(sparse[sparse.length - 1]!);
  });
});

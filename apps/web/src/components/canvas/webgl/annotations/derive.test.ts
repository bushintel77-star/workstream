import { describe, expect, it } from "vitest";
import { deriveSurveyedPlanModel, formatRl, formatSurveyBearing } from "./derive";

describe("survey annotation derivation", () => {
  const boundary = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ];

  const levels = [
    { x_pct: 20, y_pct: 20, z_m: 100.5, source: "authored" as const },
    { x_pct: 70, y_pct: 50, z_m: -0.25, source: "vicmap_contour" as const },
  ];

  const placements = [
    {
      id: "p-1",
      symbol_id: "lophostemon-confertus",
      x_pct: 40,
      y_pct: 55,
      rotation_deg: 0,
      scale: 1,
    },
  ];

  const features = [
    {
      id: "f-1",
      type: "LandscapeFeature" as const,
      metadata: {
        layer: "hardscape" as const,
        timestamp_created: new Date().toISOString(),
        source_attribution: "human_drawn" as const,
        user_modification_state: "accepted" as const,
      },
      geometry: {
        type: "Polygon" as const,
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: [
          { id: "a", pct: { x_pct: 25, y_pct: 65 } },
          { id: "b", pct: { x_pct: 45, y_pct: 65 } },
          { id: "c", pct: { x_pct: 45, y_pct: 80 } },
          { id: "d", pct: { x_pct: 25, y_pct: 80 } },
        ],
      },
      material_fill: {
        type: "surface" as const,
        sku: "bluestone-paver",
        depth_m: 0.06,
        waste_allocation_pct: 10,
      },
    },
  ];

  it("formats survey bearings and RL labels with fixed precision", () => {
    expect(formatSurveyBearing({ x: 0, y: 0 }, { x: 10, y: -10 })).toMatch(
      /^N\d{2}°\d{2}'\d{2}"E$/,
    );
    expect(formatRl(100.5)).toBe("+100.50");
    expect(formatRl(-1.25)).toBe("-1.25");
  });

  it("keeps references stable while switching dialect style", () => {
    const technical = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels,
      placements,
      features,
      density: "full",
    });
    const creative = deriveSurveyedPlanModel({
      dialect: "creative",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels,
      placements,
      features,
      density: "full",
    });
    expect(technical.propertyLines.map((l) => l.label)).toEqual(
      creative.propertyLines.map((l) => l.label),
    );
    expect(technical.elevationMarks.map((m) => m.rlText)).toEqual(
      creative.elevationMarks.map((m) => m.rlText),
    );
    expect(technical.plantTags.map((p) => p.code)).toEqual(
      creative.plantTags.map((p) => p.code),
    );
    expect(technical.styleProfile.dialect).toBe("technical");
    expect(creative.styleProfile.dialect).toBe("creative");
  });

  it("reduces annotation density in compact mode", () => {
    const full = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: Array.from({ length: 14 }).map((_, i) => ({
        x_pct: 15 + i,
        y_pct: 30 + i,
        z_m: i,
        source: "authored" as const,
      })),
      placements: Array.from({ length: 20 }).map((_, i) => ({
        id: `p-${i}`,
        symbol_id: "lomandra-longifolia",
        x_pct: 15 + i,
        y_pct: 40,
        rotation_deg: 0,
        scale: 1,
      })),
      features,
      density: "full",
    });
    const compact = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: Array.from({ length: 14 }).map((_, i) => ({
        x_pct: 15 + i,
        y_pct: 30 + i,
        z_m: i,
        source: "authored" as const,
      })),
      placements: Array.from({ length: 20 }).map((_, i) => ({
        id: `p-${i}`,
        symbol_id: "lomandra-longifolia",
        x_pct: 15 + i,
        y_pct: 40,
        rotation_deg: 0,
        scale: 1,
      })),
      features,
      density: "compact",
    });
    expect(compact.elevationMarks.length).toBeLessThan(full.elevationMarks.length);
    expect(compact.plantTags.length).toBeLessThan(full.plantTags.length);
  });
});

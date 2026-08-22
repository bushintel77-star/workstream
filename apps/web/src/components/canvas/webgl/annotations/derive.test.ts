import { describe, expect, it } from "vitest";
import {
  deriveSurveyedPlanModel,
  formatRl,
  formatSurveyBearing,
  surveyEdgeLabel,
} from "./derive";

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
    expect(formatSurveyBearing({ x: 0, y: 0 }, { x: 0, y: -10 }, 90)).toBe(
      'N90°00\'00"E',
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

  it("derives live legend values from model data (no static placeholders)", () => {
    const model = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels,
      placements,
      features,
      density: "full",
    });
    const legend = new Map(model.legendEntries.map((entry) => [entry.id, entry.value]));
    expect(legend.get("boundary")).toBe(model.propertyLines[0]!.label);
    expect(legend.get("proposed-rl")).toBe("PR +100.50");
    expect(legend.get("existing-rl")).toBe("EX -0.25");
    expect(legend.get("plant-tags")).toContain("lophostemon-confertus");
    expect(legend.get("boundary")).not.toBe('N45°12\'30"E 23.45 m');
  });

  it("labels each boundary edge once, keyed to the dimension ring", () => {
    const model = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      northBearingDeg: 12,
      levels,
      placements,
      features,
      density: "full",
    });
    // Keys must match `edgeSegments(boundary, "B", …)`, which is what renders
    // them — the two systems used to label the same edge independently.
    expect(model.propertyLines.map((l) => l.key)).toEqual(["B1", "B2", "B3", "B4"]);
    expect(model.propertyLines[0]!.label).toBe(
      surveyEdgeLabel(
        "B1",
        model.propertyLines[0]!.bearing,
        model.propertyLines[0]!.distanceM,
      ),
    );
    // One label per edge, no duplicates.
    expect(new Set(model.propertyLines.map((l) => l.key)).size).toBe(
      model.propertyLines.length,
    );
  });

  it("omits the bearing entirely when north is uncalibrated", () => {
    const uncalibrated = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      northBearingDeg: null,
      levels,
      placements,
      features,
      density: "full",
    });
    for (const line of uncalibrated.propertyLines) {
      expect(line.bearing).toBe("");
      // A DMS bearing computed off board north is a precise-looking fiction.
      expect(line.label).not.toMatch(/[NS]\d{2}°/);
      expect(line.label).toMatch(/^B\d+ · \d+\.\d{2} m$/);
    }

    const calibrated = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      northBearingDeg: 12,
      levels,
      placements,
      features,
      density: "full",
    });
    expect(calibrated.propertyLines[0]!.bearing).toMatch(/^[NS]\d{2}°/);
    expect(calibrated.propertyLines[0]!.label).toContain(
      calibrated.propertyLines[0]!.bearing,
    );
  });

  it("groups callouts per species instead of repeating one per placement", () => {
    // Twelve placements of two species, and no polygon features — the exact
    // shape that used to emit six boxes all reading the same truncated
    // "Intent: frame planting rhythm (…)".
    const manyOfTwoSpecies = Array.from({ length: 12 }).map((_, i) => ({
      id: `p-${i}`,
      symbol_id: i % 2 === 0 ? "lomandra-longifolia" : "lophostemon-confertus",
      x_pct: 20 + i * 4,
      y_pct: 40 + (i % 3) * 5,
      rotation_deg: 0,
      scale: 1,
    }));
    const model = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: [],
      placements: manyOfTwoSpecies,
      features: [],
      density: "full",
    });

    expect(model.callouts).toHaveLength(2);
    expect(new Set(model.callouts.map((c) => c.text)).size).toBe(2);
    expect(model.callouts.every((c) => c.count === 6)).toBe(true);
    // The count is surfaced in the text so a grouped box reads as a group.
    expect(model.callouts[0]!.text).toContain("×6");
  });

  it("front-loads the distinguishing token so truncation cannot eat it", () => {
    const model = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: [],
      placements,
      features,
      density: "full",
    });
    for (const callout of model.callouts) {
      // Nothing may lead with generic prose — the old text began "Intent:" and
      // ellipsis-truncated the plant code that was its only distinguishing part.
      expect(callout.text).not.toMatch(/^Intent/);
      expect(callout.text.trim()).not.toBe("");
    }
    const material = model.callouts.find((c) => c.text.startsWith("Bluestone"));
    expect(material, "material callout should be named by its sku").toBeDefined();
  });

  it("gives one stable code per species, unique across the schedule", () => {
    const twoOfEach = [
      { id: "a1", symbol_id: "lomandra-longifolia", x_pct: 20, y_pct: 20, rotation_deg: 0, scale: 1 },
      { id: "a2", symbol_id: "lomandra-longifolia", x_pct: 30, y_pct: 20, rotation_deg: 0, scale: 1 },
      { id: "b1", symbol_id: "lophostemon-confertus", x_pct: 40, y_pct: 20, rotation_deg: 0, scale: 1 },
      { id: "b2", symbol_id: "lophostemon-confertus", x_pct: 50, y_pct: 20, rotation_deg: 0, scale: 1 },
    ];
    const model = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: [],
      placements: twoOfEach,
      features: [],
      density: "full",
    });
    const codeBySymbol = new Map<string, Set<string>>();
    for (const tag of model.plantTags) {
      const set = codeBySymbol.get(tag.symbolId) ?? new Set<string>();
      set.add(tag.code);
      codeBySymbol.set(tag.symbolId, set);
    }
    // A schedule code identifies a species, not an instance.
    for (const [symbolId, codes] of codeBySymbol) {
      expect(codes.size, `${symbolId} got more than one code`).toBe(1);
    }
    const allCodes = [...codeBySymbol.values()].map((s) => [...s][0]!);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  it("keeps plant codes stable when density compacts the view", () => {
    const many = Array.from({ length: 20 }).map((_, i) => ({
      id: `p-${i}`,
      symbol_id: `species-${i % 5}`,
      x_pct: 15 + i * 3,
      y_pct: 40,
      rotation_deg: 0,
      scale: 1,
    }));
    const args = {
      dialect: "technical" as const,
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      levels: [],
      placements: many,
      features: [],
    };
    const full = deriveSurveyedPlanModel({ ...args, density: "full" });
    const compact = deriveSurveyedPlanModel({ ...args, density: "compact" });
    const codeFor = (model: typeof full, symbolId: string) =>
      model.plantTags.find((t) => t.symbolId === symbolId)?.code;
    for (const tag of compact.plantTags) {
      expect(codeFor(compact, tag.symbolId)).toBe(codeFor(full, tag.symbolId));
    }
  });

  it("marks north calibration truth in legend conventions", () => {
    const calibrated = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      northBearingDeg: 17.5,
      levels,
      placements,
      features,
      density: "full",
    });
    const uncalibrated = deriveSurveyedPlanModel({
      dialect: "technical",
      boundaryPct: boundary,
      scaleM: 110,
      boardAspect: 1,
      northBearingDeg: null,
      levels,
      placements,
      features,
      density: "full",
    });
    const byId = (entries: typeof calibrated.legendEntries) =>
      new Map(entries.map((entry) => [entry.id, entry.value]));
    expect(byId(calibrated.legendEntries).get("north-calibration")).toContain(
      "17.5° true",
    );
    expect(byId(uncalibrated.legendEntries).get("north-calibration")).toBe(
      "Uncalibrated — locational-indicative",
    );
  });
});

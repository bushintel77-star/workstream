import { describe, expect, it } from "vitest";
import { visibleLegendEntries, groupedLegendEntries } from "./legend";
import type { SurveyedPlanNotationModel } from "./model";

const MODEL: SurveyedPlanNotationModel = {
  dialect: "technical",
  styleProfile: {
    dialect: "technical",
    hierarchy: { boundaryPx: 2, annotationPx: 1, guidePx: 0.8 },
    categories: {
      property_line: { stroke: "#000", strokeWidth: 2, text: "#000" },
      elevation_rl: { stroke: "#111", strokeWidth: 1, text: "#111" },
      plant_tag: { stroke: "#222", strokeWidth: 1, text: "#222" },
      material_hatch: { stroke: "#333", strokeWidth: 0.8, text: "#333" },
      detail_callout: { stroke: "#444", strokeWidth: 1, text: "#444" },
      scope_outline: { stroke: "#555", strokeWidth: 1, text: "#555" },
    },
  },
  lineHierarchy: { boundaryPx: 2, annotationPx: 1, guidePx: 0.8 },
  propertyLines: [],
  elevationMarks: [],
  plantTags: [],
  materialHatches: [],
  callouts: [],
  scopeOutlines: [],
  legendEntries: [
    { id: "b", category: "property_line", group: "boundaries", label: "Boundary", value: "x" },
    { id: "rl", category: "elevation_rl", group: "levels", label: "RL", value: "x" },
    { id: "pt", category: "plant_tag", group: "plants", label: "Plant", value: "x" },
    { id: "cv", category: "property_line", group: "conventions", label: "Units", value: "x" },
  ],
};

describe("annotation legend filtering", () => {
  it("shows only active symbol families plus conventions", () => {
    const entries = visibleLegendEntries(MODEL, {
      propertyLines: true,
      elevations: false,
      plants: false,
      materials: false,
      callouts: false,
      scope: false,
    });
    expect(entries.map((e) => e.id)).toEqual(["b", "cv"]);
  });

  it("groups entries in drafting reading order", () => {
    const entries = visibleLegendEntries(MODEL, {
      propertyLines: true,
      elevations: true,
      plants: true,
      materials: false,
      callouts: false,
      scope: false,
    });
    const groups = groupedLegendEntries(entries).map((group) => group.group);
    expect(groups).toEqual(["boundaries", "levels", "plants", "conventions"]);
  });
});

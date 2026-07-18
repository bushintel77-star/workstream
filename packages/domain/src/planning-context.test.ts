import { describe, expect, it } from "vitest";
import { assessPlanningFromSketch, detectMunicipality } from "./planning-context";

describe("detectMunicipality", () => {
  it("detects Stonnington", () => {
    expect(detectMunicipality("12 Malvern Rd, Malvern VIC")).toBe("stonnington");
  });

  it("detects Yarra", () => {
    expect(detectMunicipality("8 Brunswick St, Fitzroy VIC")).toBe("yarra");
  });
});

describe("assessPlanningFromSketch", () => {
  it("flags TRP when protection zone placed", () => {
    const flags = assessPlanningFromSketch(
      "1 Test St, Prahran VIC",
      { lot_area_m2: 500, house_area_m2: 200, garden_area_m2: 300 },
      {
        id: "c1",
        project_id: "p1",
        placements: [
          {
            id: "a",
            symbol_id: "tree-root-protection",
            x_pct: 50,
            y_pct: 50,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        strokes: [],
        irrigation_zones: [],
        annotations: [],
        features: [],
        updated_at: new Date().toISOString(),
      },
    );
    expect(flags.some((f) => f.id === "trp-as4970")).toBe(true);
  });

  it("flags Stonnington stormwater when pool on plan", () => {
    const flags = assessPlanningFromSketch(
      "5 High St, Armadale VIC",
      { lot_area_m2: 600, house_area_m2: 250, garden_area_m2: 350 },
      {
        id: "c1",
        project_id: "p1",
        placements: [
          {
            id: "a",
            symbol_id: "pool",
            x_pct: 40,
            y_pct: 60,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        strokes: [],
        irrigation_zones: [],
        annotations: [],
        features: [],
        updated_at: new Date().toISOString(),
      },
    );
    expect(flags.some((f) => f.id === "stonnington-stormwater")).toBe(true);
  });
});

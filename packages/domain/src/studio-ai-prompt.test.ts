import { describe, expect, it } from "vitest";
import {
  buildAssistSiteIntel,
  buildStudioSystemPrompt,
} from "./studio-ai-prompt";

describe("buildStudioSystemPrompt", () => {
  it("grounds the model with workable area and easement honesty", () => {
    const prompt = buildStudioSystemPrompt(
      { name: "Test", address: "12 Demo St, Melbourne VIC 3000" },
      4,
      {
        width_m: 12,
        height_m: 28,
        workable_m2: 186,
        easement_count: 1,
        service_count: 2,
        scale_m: 110,
        compliance_summary: "Compliance: outdoor ok · permeable fail",
        shade_summary: "Shade mesh (indicative midday): avg 5.2 h sun",
      },
    );
    expect(prompt).toContain("Workable outdoor canvas");
    expect(prompt).toContain("186");
    expect(prompt).toContain("easement hatch");
    expect(prompt).toContain("service corridor");
    expect(prompt).toContain("outside easement hatch");
    expect(prompt).toContain("Studio palette");
    expect(prompt).toContain("permeable fail");
    expect(prompt).toContain("Shade mesh");
  });
});

describe("buildAssistSiteIntel", () => {
  it("summarises compliance and shade from placements", () => {
    const intel = buildAssistSiteIntel({
      outdoorM2: 180,
      lat: -37.85,
      lng: 145.0,
      placements: [
        {
          id: "a",
          symbol_id: "bluestone-paver",
          x_pct: 40,
          y_pct: 55,
          scale: 1.4,
        },
        {
          id: "b",
          symbol_id: "existing-tree-retain",
          x_pct: 70,
          y_pct: 40,
          label: "exist:dbh=0.55",
        },
      ],
    });
    expect(intel.compliance_summary).toMatch(/Compliance:/);
    expect(intel.shade_summary).toMatch(/Shade mesh/);
    expect(intel.sun_hours).toBeGreaterThan(0);
  });
});

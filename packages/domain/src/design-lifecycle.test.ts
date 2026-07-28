import { describe, expect, it } from "vitest";
import {
  DESIGN_LIFECYCLE_PHASES,
  resolvePhaseCapabilities,
  suggestPhaseFromProjectStatus,
} from "./design-lifecycle";

describe("suggestPhaseFromProjectStatus", () => {
  it("maps early pipeline to concept", () => {
    expect(suggestPhaseFromProjectStatus("draft")).toBe("concept");
    expect(suggestPhaseFromProjectStatus("survey_review")).toBe("concept");
  });

  it("maps design and cost review into development / docs", () => {
    expect(suggestPhaseFromProjectStatus("design_review")).toBe(
      "design_development",
    );
    expect(suggestPhaseFromProjectStatus("cost_review")).toBe(
      "construction_docs",
    );
  });

  it("maps complete to post-occupancy", () => {
    expect(suggestPhaseFromProjectStatus("complete")).toBe("post_occupancy");
  });
});

describe("resolvePhaseCapabilities", () => {
  it("expects zones and sheet by construction docs", () => {
    const caps = resolvePhaseCapabilities("construction_docs");
    expect(caps.expectZones).toBe(true);
    expect(caps.expectSheet).toBe(true);
    expect(caps.expectQuote).toBe(true);
  });

  it("keeps concept light", () => {
    const caps = resolvePhaseCapabilities("concept");
    expect(caps.expectServices).toBe(false);
    expect(caps.expectQuote).toBe(false);
  });

  it("covers every phase", () => {
    for (const phase of DESIGN_LIFECYCLE_PHASES) {
      expect(resolvePhaseCapabilities(phase).tip.length).toBeGreaterThan(8);
    }
  });
});

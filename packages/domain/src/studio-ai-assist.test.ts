import { describe, expect, it } from "vitest";
import {
  buildGhostPlacementSuggestions,
  buildSketchCanvasAiSuggestions,
  buildStudioAiSuggestions,
  withDirtySaveSuggestion,
} from "./studio-ai-assist";

describe("buildStudioAiSuggestions", () => {
  it("prioritises tier-1 quote path for Wrights Terrace", () => {
    const s = buildStudioAiSuggestions({
      placementCount: 2,
      strokeCount: 0,
      zoneCount: 0,
      hasPlanningSymbol: false,
      tier1: true,
      hasDesign: false,
    });
    expect(s[0]?.id).toBe("tier1-massing");
    expect(s.some((x) => x.action === "quote")).toBe(true);
  });

  it("suggests start sketch when empty", () => {
    const s = buildStudioAiSuggestions({
      placementCount: 0,
      strokeCount: 0,
      zoneCount: 0,
      hasPlanningSymbol: false,
      tier1: false,
      hasDesign: false,
    });
    expect(s.some((x) => x.id === "start-sketch")).toBe(true);
  });
});

describe("withDirtySaveSuggestion", () => {
  it("adds save card when dirty", () => {
    const s = withDirtySaveSuggestion([], true);
    expect(s.some((x) => x.id === "save")).toBe(true);
  });
});

describe("buildGhostPlacementSuggestions", () => {
  it("returns tier-1 hornbeam ghost when symbol exists", () => {
    const g = buildGhostPlacementSuggestions({
      tier1: true,
      symbolIds: ["hornbeam-pleached", "tree-root-protection"],
    });
    expect(g.some((x) => x.symbol_id === "hornbeam-pleached")).toBe(true);
  });
});

describe("buildSketchCanvasAiSuggestions", () => {
  it("coaches structure-first on empty canvas", () => {
    const s = buildSketchCanvasAiSuggestions({
      placementCount: 0,
      hasPlanningSymbol: false,
      hasHardscape: false,
      hasStructurePlanting: false,
      tier1: false,
      sketchReadyForCad: false,
    });
    expect(s[0]?.id).toBe("structure-first");
    expect(s[0]?.action).toBe("place");
  });

  it("promotes draft CAD when sketch is dense enough", () => {
    const s = buildSketchCanvasAiSuggestions({
      placementCount: 4,
      hasPlanningSymbol: true,
      hasHardscape: true,
      hasStructurePlanting: true,
      tier1: false,
      sketchReadyForCad: true,
    });
    expect(s.some((x) => x.action === "cad")).toBe(true);
  });
});

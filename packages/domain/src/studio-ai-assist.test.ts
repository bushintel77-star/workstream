import { describe, expect, it } from "vitest";
import {
  buildGhostPlacementSuggestions,
  buildStudioAiSuggestions,
  withDirtySaveSuggestion,
} from "./studio-ai-assist";

describe("buildStudioAiSuggestions", () => {
  it("prioritises tier-1 develop for Wrights Terrace", () => {
    const s = buildStudioAiSuggestions({
      placementCount: 2,
      strokeCount: 0,
      zoneCount: 0,
      hasPlanningSymbol: false,
      tier1: true,
      hasDesign: false,
    });
    expect(s[0]?.id).toBe("tier1-massing");
    expect(s.some((x) => x.action === "develop")).toBe(true);
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

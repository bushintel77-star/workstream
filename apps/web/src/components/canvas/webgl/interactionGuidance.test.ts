import { describe, expect, it } from "vitest";
import { interactionGuidance } from "./interactionGuidance";

describe("interactionGuidance", () => {
  const base = {
    activeMode: "sketch" as const,
    sketchMode: false,
    measureActive: false,
    armedSymbolId: null,
    marqueeActive: false,
    trenchTool: null,
    zoneTool: null,
    splitView: false,
  };

  it("prioritizes an armed asset over the stage", () => {
    expect(interactionGuidance({ ...base, armedSymbolId: "olive" })).toEqual({
      label: "Asset armed",
      detail: "Click the site to place it · Esc cancels",
    });
  });

  it("explains sketch interaction and cancellation", () => {
    expect(interactionGuidance({ ...base, sketchMode: true }).detail).toContain(
      "Drag on the site to draw",
    );
  });

  it("explains the current stage when no tool is armed", () => {
    expect(interactionGuidance({ ...base, activeMode: "quote" })).toEqual({
      label: "Quote mode",
      detail: "Review what is included in the live estimate",
    });
  });
});

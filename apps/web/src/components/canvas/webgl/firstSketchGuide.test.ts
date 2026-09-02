import { describe, expect, it } from "vitest";
import { guideFirstSketch } from "./firstSketchGuide";

describe("guideFirstSketch — guided first-sketch handoff gate", () => {
  it("arms when the board is empty, in sketch, and not e2e (with boundary)", () => {
    expect(
      guideFirstSketch({
        boundaryPointCount: 4,
        hasDesignContent: false,
        mode: "sketch",
        isE2e: false,
      }),
    ).toBe(true);
  });

  it("arms on a blank unscaled board with no boundary (turn 15: drawing never waits)", () => {
    expect(
      guideFirstSketch({
        boundaryPointCount: 0,
        hasDesignContent: false,
        mode: "sketch",
        isE2e: false,
      }),
    ).toBe(true);
  });

  it("never arms once content exists", () => {
    expect(
      guideFirstSketch({
        boundaryPointCount: 4,
        hasDesignContent: true,
        mode: "sketch",
        isE2e: false,
      }),
    ).toBe(false);
  });

  it("never arms outside sketch mode", () => {
    for (const mode of ["survey", "cad", "elevation", "garden", "quote", "present", "share"] as const) {
      expect(
        guideFirstSketch({
          boundaryPointCount: 4,
          hasDesignContent: false,
          mode,
          isE2e: false,
        }),
      ).toBe(false);
    }
  });

  it("never arms under e2e (specs seed their own tool state)", () => {
    expect(
      guideFirstSketch({
        boundaryPointCount: 4,
        hasDesignContent: false,
        mode: "sketch",
        isE2e: true,
      }),
    ).toBe(false);
  });
});

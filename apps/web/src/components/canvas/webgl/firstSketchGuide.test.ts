import { describe, expect, it } from "vitest";
import { createFirstSketchHintLatch, guideFirstSketch } from "./firstSketchGuide";

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

describe("createFirstSketchHintLatch — retirement is latched, not re-derived", () => {
  it("stays retired when the content gate transiently reopens", () => {
    const latch = createFirstSketchHintLatch();
    expect(latch.retired).toBe(false);
    latch.observe(true); // first ink lands — the hint retires
    expect(latch.retired).toBe(true);
    // A later HUD cycle briefly recomputes the board as empty; the latch
    // must hold so the prompt never resurrects over ink.
    latch.observe(false);
    expect(latch.retired).toBe(true);
  });

  it("stays unretired on an untouched empty board", () => {
    const latch = createFirstSketchHintLatch();
    latch.observe(false);
    latch.observe(false);
    expect(latch.retired).toBe(false);
  });

  it("a board that mounts with content latches on first sight", () => {
    const latch = createFirstSketchHintLatch();
    latch.observe(true);
    expect(latch.retired).toBe(true);
  });
});

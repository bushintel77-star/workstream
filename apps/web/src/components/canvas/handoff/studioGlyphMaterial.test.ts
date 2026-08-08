import { describe, expect, it } from "vitest";
import { planHatchForItem } from "./StudioGlyph";

describe("planHatchForItem", () => {
  it("reads the paving material off the placed symbol", () => {
    expect(planHatchForItem("paving", "bluestone-paver")).toBe("bluestone");
    expect(planHatchForItem("paving", "porcelain-tile")).toBe("porcelain");
    expect(planHatchForItem("paving", "granite-stepper")).toBe("stepper");
    expect(planHatchForItem("paving", "sandstone-crazy")).toBe("crazypave");
    expect(planHatchForItem("paving", "exposed-aggregate")).toBe("aggregate");
    expect(planHatchForItem("paving", "hoggin-path")).toBe("hoggin");
    expect(planHatchForItem("paving", "gravel-mulch")).toBe("gravel");
  });

  it("keeps stone-family paving on the bluestone hatch", () => {
    expect(planHatchForItem("paving", "basalt-grid")).toBe("bluestone");
    expect(planHatchForItem("paving", "bluestone-step")).toBe("bluestone");
    expect(planHatchForItem("paving", "limestone-coping")).toBe("bluestone");
  });

  it("reads decking as timber, including the ladder rung", () => {
    expect(planHatchForItem("deck", "timber-deck")).toBe("deck");
    expect(planHatchForItem("deck", "curtis-deck-050")).toBe("deck");
  });

  it("falls back to the coarse type default with no symbol", () => {
    // Preserves the pre-Tier-3 look for legacy and painted placements.
    expect(planHatchForItem("paving")).toBe("bluestone");
    expect(planHatchForItem("deck")).toBe("deck");
    expect(planHatchForItem("paving", "some-future-symbol")).toBe("bluestone");
  });

  it("is null for types that carry no hatch", () => {
    expect(planHatchForItem("canopy")).toBeNull();
    expect(planHatchForItem("hedge")).toBeNull();
    expect(planHatchForItem("lawn")).toBeNull();
    expect(planHatchForItem("bed")).toBeNull();
    expect(planHatchForItem("exist")).toBeNull();
    expect(planHatchForItem("frenchdrain")).toBeNull();
    expect(planHatchForItem("feature")).toBeNull();
  });

  it("does not let a paving symbol leak onto a planting type", () => {
    // A mis-typed pairing must not silently hatch a tree as stone.
    expect(planHatchForItem("canopy", "bluestone-paver")).toBeNull();
  });
});

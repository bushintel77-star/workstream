import { describe, expect, it } from "vitest";
import { buildAssetPalette } from "./assetPalette";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";

describe("buildAssetPalette", () => {
  it("offers the curated dock order (8 types, exist excluded)", () => {
    const palette = buildAssetPalette();
    expect(palette.map((e) => e.type)).toEqual([
      "canopy",
      "hedge",
      "bed",
      "lawn",
      "feature",
      "paving",
      "deck",
      "frenchdrain",
    ]);
    // Existing trees are surveyed, not palette-placed.
    expect(palette.some((e) => e.type === "exist")).toBe(false);
  });

  it("every symbol id round-trips through TYPE_TO_SYMBOL (hydrate guarantee)", () => {
    const palette = buildAssetPalette();
    const validIds = new Set(Object.values(TYPE_TO_SYMBOL));
    for (const e of palette) expect(validIds.has(e.symbolId)).toBe(true);
  });

  it("carries real catalog metadata where it exists (never invented)", () => {
    const palette = buildAssetPalette();
    const hornbeam = palette.find((e) => e.type === "hedge")!;
    expect(hornbeam.symbolId).toBe("hornbeam-pleached");
    expect(hornbeam.botanicalName).toBe("Carpinus betulus");
    expect(hornbeam.heightM).toBe(3.5);
    expect(hornbeam.spreadM).toBe(4);

    const olive = palette.find((e) => e.type === "canopy")!;
    expect(olive.symbolId).toBe("olive-standard");
    expect(olive.botanicalName).toBe("Olea europaea");
  });

  it("coarse ids without catalog entries fall back to type labels (no fake botany)", () => {
    const palette = buildAssetPalette();
    const deck = palette.find((e) => e.type === "deck")!;
    expect(deck.symbolId).toBe("deck");
    expect(deck.botanicalName).toBeUndefined();
    expect(deck.label).toBe("Decking");
  });

  it("groups botanicals as plants and surfaces as hardscape", () => {
    const palette = buildAssetPalette();
    const byType = new Map(palette.map((e) => [e.type, e.category]));
    expect(byType.get("canopy")).toBe("plant");
    expect(byType.get("hedge")).toBe("plant");
    expect(byType.get("lawn")).toBe("hardscape");
    expect(byType.get("paving")).toBe("hardscape");
  });

  it("is deterministic — identical output across calls", () => {
    expect(buildAssetPalette()).toEqual(buildAssetPalette());
  });
});

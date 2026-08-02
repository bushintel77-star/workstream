import { describe, expect, it } from "vitest";
import { CURTIS_CATALOG_SYMBOLS } from "./catalog";
import {
  CURTIS_GARDEN_LADDER_ASSETS,
  GARDEN_SIZE_LADDER,
  gardenLadderSteps,
  gardenSizeStep,
  isGardenLadderId,
  ladderHeightCode,
  nearestLadderStep,
} from "./garden-size-ladder";
import { isSketchGoldStandard } from "./sketch-gold-library";

describe("garden size ladder", () => {
  it("ships the briefed heights exactly", () => {
    expect(gardenSizeStep("curtis-tree-780")?.heightM).toBe(7.8);
    expect(gardenSizeStep("curtis-tree-690")?.heightM).toBe(6.9);
    expect(gardenSizeStep("curtis-hedge-140")?.heightM).toBe(1.4);
    expect(gardenSizeStep("curtis-hedge-120")?.heightM).toBe(1.2);
    expect(gardenSizeStep("curtis-deck-050")?.heightM).toBe(0.5);
  });

  it("encodes height as a stable 3-digit centimetre code", () => {
    expect(ladderHeightCode(7.8)).toBe("780");
    expect(ladderHeightCode(1.2)).toBe("120");
    expect(ladderHeightCode(0.5)).toBe("050");
    expect(ladderHeightCode(0.9)).toBe("090");
  });

  it("groups rungs by family, tallest first", () => {
    expect(gardenLadderSteps("tree").map((s) => s.heightM)).toEqual([
      7.8, 6.9, 5, 3.5,
    ]);
    expect(gardenLadderSteps("hedge").map((s) => s.heightM)).toEqual([
      1.8, 1.4, 1.2, 0.9,
    ]);
    expect(gardenLadderSteps("deck").map((s) => s.heightM)).toEqual([0.5]);
  });

  it("labels rungs with the height so palette and elevation agree", () => {
    expect(gardenSizeStep("curtis-tree-780")?.label).toBe("Canopy tree · 7.8 m");
    expect(gardenSizeStep("curtis-tree-350")?.label).toBe("Feature tree · 3.5 m");
    expect(gardenSizeStep("curtis-hedge-140")?.label).toBe(
      "Clipped hedge · 1.4 m",
    );
    expect(gardenSizeStep("curtis-deck-050")?.label).toBe("Timber deck · 0.5 m");
  });

  it("places tall trees as canopy and short ones as feature", () => {
    expect(gardenSizeStep("curtis-tree-780")?.studioType).toBe("canopy");
    expect(gardenSizeStep("curtis-tree-690")?.studioType).toBe("canopy");
    expect(gardenSizeStep("curtis-tree-500")?.studioType).toBe("feature");
    expect(gardenSizeStep("curtis-hedge-120")?.studioType).toBe("hedge");
    expect(gardenSizeStep("curtis-deck-050")?.studioType).toBe("deck");
  });

  it("recognises ladder ids and rejects everything else", () => {
    expect(isGardenLadderId("curtis-tree-780")).toBe(true);
    expect(isGardenLadderId("curtis-deck-050")).toBe(true);
    expect(isGardenLadderId("hornbeam-pleached")).toBe(false);
    expect(isGardenLadderId("curtis-tree-78")).toBe(false);
    expect(isGardenLadderId("wikimedia-tree-oak")).toBe(false);
  });

  it("snaps a measured height onto the nearest rung", () => {
    expect(nearestLadderStep("tree", 7.4)?.id).toBe("curtis-tree-780");
    expect(nearestLadderStep("tree", 6.5)?.id).toBe("curtis-tree-690");
    expect(nearestLadderStep("hedge", 1.35)?.id).toBe("curtis-hedge-140");
    expect(nearestLadderStep("hedge", 10)?.id).toBe("curtis-hedge-180");
    expect(nearestLadderStep("screen", 2)).toBeUndefined();
  });
});

describe("garden ladder catalog symbols", () => {
  it("carries mature height and spread on every rung", () => {
    expect(CURTIS_GARDEN_LADDER_ASSETS).toHaveLength(GARDEN_SIZE_LADDER.length);
    for (const step of GARDEN_SIZE_LADDER) {
      const symbol = CURTIS_GARDEN_LADDER_ASSETS.find((s) => s.id === step.id);
      expect(symbol, step.id).toBeDefined();
      expect(symbol!.mature_height_m).toBe(step.heightM);
      expect(symbol!.default_width_m).toBe(step.spreadM);
      expect(symbol!.asset?.layers.length).toBeGreaterThan(0);
    }
  });

  it("passes the gold-standard gate so the library renders it", () => {
    for (const symbol of CURTIS_GARDEN_LADDER_ASSETS) {
      expect(isSketchGoldStandard(symbol), symbol.id).toBe(true);
    }
  });

  it("is searchable by height string", () => {
    const tall = CURTIS_GARDEN_LADDER_ASSETS.find(
      (s) => s.id === "curtis-tree-780",
    );
    expect(tall?.keywords).toContain("7.8");
    expect(tall?.keywords).toContain("7.8m");
  });

  it("joins the catalog without colliding with existing symbol ids", () => {
    const ids = CURTIS_CATALOG_SYMBOLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of GARDEN_SIZE_LADDER) {
      expect(ids).toContain(step.id);
    }
  });

  it("draws taller rungs taller on the palette card", () => {
    const crownR = (id: string) => {
      const symbol = CURTIS_GARDEN_LADDER_ASSETS.find((s) => s.id === id);
      const trunk = symbol!.asset!.layers[1]!.d;
      // `M24 42V<trunkTopY>` — a taller tree has a higher (smaller) trunk top.
      return Number.parseFloat(trunk.split("V")[1]!);
    };
    expect(crownR("curtis-tree-780")).toBeLessThan(crownR("curtis-tree-350"));
  });
});

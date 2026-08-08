import { describe, expect, it } from "vitest";
import {
  gardenFamilyForSymbol,
  hasElevationPresence,
  symbolMatureHeightM,
  symbolSpreadM,
} from "./garden-asset-height";

describe("symbolMatureHeightM", () => {
  it("reads the ladder rung first", () => {
    expect(symbolMatureHeightM("curtis-tree-780")).toBe(7.8);
    expect(symbolMatureHeightM("curtis-hedge-140")).toBe(1.4);
    expect(symbolMatureHeightM("curtis-deck-050")).toBe(0.5);
  });

  it("falls through to the catalog symbol", () => {
    expect(symbolMatureHeightM("hornbeam-pleached")).toBe(3.5);
    expect(symbolMatureHeightM("olive-standard")).toBe(5);
    expect(symbolMatureHeightM("timber-deck")).toBe(0.4);
    expect(symbolMatureHeightM("privacy-screen")).toBe(1.8);
  });

  it("leaves root-radius-coupled symbols to the coarse studio type", () => {
    // A height on these would shrink their spatial-facts root protection
    // radius — see catalog-asset-heights.test.ts.
    expect(symbolMatureHeightM("existing-tree-retain")).toBeNull();
    expect(symbolMatureHeightM("hedge-clip-formal")).toBeNull();
  });

  it("returns null for flat surfaces so they draw no profile", () => {
    expect(symbolMatureHeightM("lawn-turf")).toBeNull();
    expect(symbolMatureHeightM("bluestone-paver")).toBeNull();
    expect(symbolMatureHeightM("porcelain-tile")).toBeNull();
    expect(symbolMatureHeightM("pool")).toBeNull();
  });

  it("is null-safe for missing, empty and unknown ids", () => {
    expect(symbolMatureHeightM(null)).toBeNull();
    expect(symbolMatureHeightM(undefined)).toBeNull();
    expect(symbolMatureHeightM("")).toBeNull();
    expect(symbolMatureHeightM("   ")).toBeNull();
    expect(symbolMatureHeightM("not-a-symbol")).toBeNull();
  });

  it("is case-insensitive on the symbol id", () => {
    expect(symbolMatureHeightM("CURTIS-TREE-780")).toBe(7.8);
    expect(symbolMatureHeightM(" Olive-Standard ")).toBe(5);
  });
});

describe("symbolSpreadM", () => {
  it("prefers the ladder spread, else the catalog default width", () => {
    expect(symbolSpreadM("curtis-tree-780")).toBe(6.5);
    expect(symbolSpreadM("curtis-hedge-120")).toBe(0.6);
    expect(symbolSpreadM("hornbeam-pleached")).toBe(4);
    expect(symbolSpreadM("nope")).toBeNull();
  });
});

describe("gardenFamilyForSymbol", () => {
  it("takes the family straight from a ladder rung", () => {
    expect(gardenFamilyForSymbol("curtis-tree-780")).toBe("tree");
    expect(gardenFamilyForSymbol("curtis-tree-350")).toBe("tree");
    expect(gardenFamilyForSymbol("curtis-hedge-180")).toBe("hedge");
    expect(gardenFamilyForSymbol("curtis-deck-050")).toBe("deck");
  });

  it("reads pleached and bamboo as elevated screens, not hedges", () => {
    expect(gardenFamilyForSymbol("hornbeam-pleached")).toBe("screen");
    expect(gardenFamilyForSymbol("bamboo-screen")).toBe("screen");
  });

  it("keeps clipped green walls as hedges", () => {
    expect(gardenFamilyForSymbol("westringia-hedge")).toBe("hedge");
    expect(gardenFamilyForSymbol("pittosporum-hedge")).toBe("hedge");
    expect(gardenFamilyForSymbol("rosemary-hedge")).toBe("hedge");
    expect(gardenFamilyForSymbol("hedge-clip-formal")).toBe("hedge");
  });

  it("reads trunked forms as trees", () => {
    expect(gardenFamilyForSymbol("olive-standard")).toBe("tree");
    expect(gardenFamilyForSymbol("magnolia-little-gem")).toBe("tree");
    expect(gardenFamilyForSymbol("pyrus-capital")).toBe("tree");
    expect(gardenFamilyForSymbol("existing-tree-retain")).toBe("tree");
    expect(gardenFamilyForSymbol("tree-fern")).toBe("tree");
  });

  it("reads massed and mounded planting as shrubs", () => {
    expect(gardenFamilyForSymbol("box-ball")).toBe("shrub");
    expect(gardenFamilyForSymbol("lomandra-mass")).toBe("shrub");
    expect(gardenFamilyForSymbol("lavender-drift")).toBe("shrub");
    expect(gardenFamilyForSymbol("poa-grass")).toBe("shrub");
    expect(gardenFamilyForSymbol("cycas-revoluta")).toBe("shrub");
  });

  it("reads decking as deck", () => {
    expect(gardenFamilyForSymbol("timber-deck")).toBe("deck");
  });

  it("returns null for structures, fixtures and annotations", () => {
    // Structures have height but are not garden planting — plain profile.
    expect(gardenFamilyForSymbol("privacy-screen")).toBeNull();
    expect(gardenFamilyForSymbol("retaining-wall")).toBeNull();
    expect(gardenFamilyForSymbol("side-gate")).toBeNull();
    expect(gardenFamilyForSymbol("pergola")).toBeNull();
    expect(gardenFamilyForSymbol("brass-bollard-light")).toBeNull();
    expect(gardenFamilyForSymbol("tree-root-protection")).toBeNull();
  });

  it("is null-safe", () => {
    expect(gardenFamilyForSymbol(null)).toBeNull();
    expect(gardenFamilyForSymbol("")).toBeNull();
    expect(gardenFamilyForSymbol("unknown-symbol-id")).toBeNull();
  });
});

describe("hasElevationPresence", () => {
  it("is true only for symbols that stand above ground", () => {
    expect(hasElevationPresence("curtis-tree-780")).toBe(true);
    expect(hasElevationPresence("timber-deck")).toBe(true);
    expect(hasElevationPresence("lawn-turf")).toBe(false);
    expect(hasElevationPresence("bluestone-paver")).toBe(false);
    expect(hasElevationPresence(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isSpeciesSymbolType } from "./SpeciesSymbol";

describe("SpeciesSymbol mapping", () => {
  it("covers plant palette types and skips hardscape", () => {
    expect(isSpeciesSymbolType("canopy")).toBe(true);
    expect(isSpeciesSymbolType("feature")).toBe(true);
    expect(isSpeciesSymbolType("hedge")).toBe(true);
    expect(isSpeciesSymbolType("bed")).toBe(true);
    expect(isSpeciesSymbolType("exist")).toBe(true);
    expect(isSpeciesSymbolType("paving")).toBe(false);
    expect(isSpeciesSymbolType("deck")).toBe(false);
    expect(isSpeciesSymbolType("lawn")).toBe(false);
  });
});

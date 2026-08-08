import { describe, expect, it } from "vitest";
import type { CatalogSymbol } from "@workstream/contracts";
import {
  filterPlantingPalette,
  preferredSunForHours,
  soilTagFromCatalog,
} from "./planting-palette-filter";

const plant = (
  id: string,
  sun: CatalogSymbol["sun"],
  soil?: string,
): CatalogSymbol =>
  ({
    id,
    label: id,
    category: "planting",
    sun,
    soil,
  }) as CatalogSymbol;

describe("planting-palette-filter", () => {
  it("maps deep shade hours to shade-first sun preference", () => {
    expect(preferredSunForHours(1)).toEqual(["shade", "partial"]);
    expect(preferredSunForHours(8)[0]).toBe("full");
  });

  it("parses soil tags from catalog copy", () => {
    expect(soilTagFromCatalog("Free-draining; tolerates clay")).toContain(
      "clay",
    );
    expect(soilTagFromCatalog("Well-drained loam")).toContain("loam");
  });

  it("filters planting by shade cell + soil tag", () => {
    const symbols = [
      plant("shade-lover", "shade", "Well-drained loam"),
      plant("sun-only", "full", "Sandy free-drain"),
      plant("clay-partial", "partial", "tolerates clay"),
      {
        id: "paver",
        label: "Paver",
        category: "hardscape",
      } as CatalogSymbol,
    ];
    const filtered = filterPlantingPalette(symbols, {
      sunHours: 1.5,
      soil: "clay",
      aspect: "N",
    });
    const ids = filtered.map((s) => s.id);
    expect(ids).toContain("paver");
    expect(ids).toContain("clay-partial");
    expect(ids).not.toContain("sun-only");
  });
});

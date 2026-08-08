import { describe, expect, it } from "vitest";
import type { CatalogSymbol } from "@workstream/contracts";
import {
  buildSketchLibraryGroups,
  isSketchGoldStandard,
  searchSketchLibrary,
} from "./sketch-gold-library";

function sym(
  partial: Partial<CatalogSymbol> & Pick<CatalogSymbol, "id" | "label" | "category">,
): CatalogSymbol {
  return {
    path_d: "M0 0h10v10H0z",
    default_width_m: 2,
    keywords: [],
    ...partial,
  };
}

describe("isSketchGoldStandard", () => {
  it("accepts sized Curtis gold ids", () => {
    expect(
      isSketchGoldStandard(
        sym({
          id: "hornbeam-pleached",
          label: "Pleached hornbeam",
          category: "planting",
          default_width_m: 4,
        }),
      ),
    ).toBe(true);
  });

  it("rejects edible crops and unsized glyphs", () => {
    expect(
      isSketchGoldStandard(
        sym({
          id: "opencrop-tomato",
          label: "Tomato",
          category: "planting",
          default_width_m: 1,
        }),
      ),
    ).toBe(false);
    expect(
      isSketchGoldStandard(
        sym({
          id: "hornbeam-pleached",
          label: "Pleached hornbeam",
          category: "planting",
          default_width_m: 0,
          path_d: "M0 0h1v1H0z",
        }),
      ),
    ).toBe(false);
  });

  it("accepts PlanZV / Osmic / Temaki gold packs", () => {
    expect(
      isSketchGoldStandard(
        sym({
          id: "planzv-parkanlage",
          label: "Park",
          category: "planting",
          default_width_m: 5,
        }),
      ),
    ).toBe(true);
    expect(
      isSketchGoldStandard(
        sym({
          id: "osmic-nature-tree",
          label: "Tree",
          category: "planting",
          default_width_m: 4,
        }),
      ),
    ).toBe(true);
    expect(
      isSketchGoldStandard(
        sym({
          id: "temaki-shrub-low",
          label: "Low shrub",
          category: "planting",
          default_width_m: 1.5,
        }),
      ),
    ).toBe(true);
    expect(
      isSketchGoldStandard(
        sym({
          id: "temaki-street-lamp-arm",
          label: "Street lamp",
          category: "lighting",
          default_width_m: 0.6,
        }),
      ),
    ).toBe(true);
    expect(
      isSketchGoldStandard(
        sym({
          id: "brass-uplight",
          label: "Brass up-light",
          category: "lighting",
          default_width_m: 0.25,
        }),
      ),
    ).toBe(true);
  });
});

describe("buildSketchLibraryGroups", () => {
  const library = [
    sym({
      id: "temaki-bench",
      label: "Bench",
      category: "furniture",
      default_width_m: 1.8,
    }),
    sym({
      id: "brass-uplight",
      label: "Brass up-light",
      category: "lighting",
      default_width_m: 0.25,
    }),
    sym({
      id: "temaki-shrub",
      label: "Shrub",
      category: "planting",
      default_width_m: 1.2,
    }),
    sym({
      id: "hornbeam-pleached",
      label: "Pleached hornbeam",
      category: "planting",
      default_width_m: 4,
    }),
    sym({
      id: "opencrop-tomato",
      label: "Tomato",
      category: "planting",
      default_width_m: 1,
    }),
  ];

  it("groups gold symbols by category in plan order, crops excluded", () => {
    const groups = buildSketchLibraryGroups(library);
    expect(groups.map((g) => g.category)).toEqual([
      "planting",
      "furniture",
      "lighting",
    ]);
    const planting = groups[0]!;
    expect(planting.label).toBe("Planting");
    expect(planting.symbols.map((s) => s.id)).toEqual([
      "hornbeam-pleached",
      "temaki-shrub",
    ]);
    expect(
      groups.flatMap((g) => g.symbols).some((s) => s.id === "opencrop-tomato"),
    ).toBe(false);
  });

  it("Curtis assets lead their category ahead of packs", () => {
    const [planting] = buildSketchLibraryGroups(library);
    expect(planting?.symbols[0]?.id).toBe("hornbeam-pleached");
  });
});

describe("searchSketchLibrary", () => {
  const library = [
    sym({
      id: "westringia-hedge",
      label: "Westringia hedge",
      category: "planting",
      default_width_m: 1.2,
      botanical_name: "Westringia fruticosa",
    }),
    sym({
      id: "temaki-hedge",
      label: "Hedge",
      category: "planting",
      default_width_m: 1,
      keywords: ["screen"],
    }),
    sym({
      id: "bluestone-paver",
      label: "Bluestone",
      category: "paving",
      default_width_m: 0.6,
    }),
  ];

  it("matches label, botanical name and keywords", () => {
    expect(searchSketchLibrary(library, "hedge").map((s) => s.id)).toEqual([
      "temaki-hedge",
      "westringia-hedge",
    ]);
    expect(searchSketchLibrary(library, "fruticosa")[0]?.id).toBe(
      "westringia-hedge",
    );
    expect(searchSketchLibrary(library, "screen")[0]?.id).toBe("temaki-hedge");
  });

  it("empty query returns nothing; limit caps results", () => {
    expect(searchSketchLibrary(library, "  ")).toEqual([]);
    expect(searchSketchLibrary(library, "e", 2)).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import type { CatalogSymbol } from "@workstream/contracts";
import {
  isSketchGoldStandard,
  selectSketchRibbonSymbols,
  SKETCH_RIBBON_STARTERS,
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

  it("accepts PlanZV / Osmic gold packs", () => {
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
  });
});

describe("selectSketchRibbonSymbols", () => {
  const library = [
    sym({
      id: "hornbeam-pleached",
      label: "Pleached hornbeam",
      category: "planting",
      default_width_m: 4,
    }),
    sym({
      id: "bluestone-paver",
      label: "Bluestone",
      category: "paving",
      default_width_m: 0.6,
    }),
    sym({
      id: "planzv-parkanlage",
      label: "Park",
      category: "planting",
      default_width_m: 5,
      keywords: ["ai cad", "design library"],
    }),
    sym({
      id: "opencrop-tomato",
      label: "Tomato",
      category: "planting",
      default_width_m: 1,
    }),
  ];

  it("essentials prefer Curtis gold and exclude crops", () => {
    const tray = selectSketchRibbonSymbols(library, "essentials", 10);
    expect(tray.every((s) => s.id !== "opencrop-tomato")).toBe(true);
    expect(tray[0]?.id).toBe("hornbeam-pleached");
  });

  it("hardscape tab filters categories", () => {
    const tray = selectSketchRibbonSymbols(library, "hardscape", 10);
    expect(tray.map((s) => s.id)).toEqual(["bluestone-paver"]);
  });

  it("ai tab surfaces design-library packs", () => {
    const tray = selectSketchRibbonSymbols(library, "ai", 10);
    expect(tray.some((s) => s.id === "planzv-parkanlage")).toBe(true);
  });

  it("starters are curated gold ids", () => {
    expect(SKETCH_RIBBON_STARTERS.length).toBeGreaterThanOrEqual(3);
    expect(SKETCH_RIBBON_STARTERS).toContain("hornbeam-pleached");
  });
});

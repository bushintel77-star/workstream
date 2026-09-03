import { describe, expect, it } from "vitest";
import { CURTIS_CATALOG_SYMBOLS, isSketchGoldStandard } from "@workstream/domain";
import {
  BENTO_CATEGORIES,
  BENTO_CATEGORY_LABEL,
  buildBentoGrid,
  filterBentoByCategory,
  bentoCategoryCounts,
  bentoTileById,
  formatDimensions,
  type BentoCategory,
} from "./assetBento";

describe("assetBento — Phase M.6", () => {
  describe("categories", () => {
    it("has the spec's five categories in order", () => {
      expect(BENTO_CATEGORIES).toEqual(["CANOPY", "SHRUB", "HARD", "FURN", "SYM"]);
    });

    it("every category has a label", () => {
      for (const cat of BENTO_CATEGORIES) {
        expect(BENTO_CATEGORY_LABEL[cat].length).toBeGreaterThan(0);
      }
    });
  });

  describe("buildBentoGrid", () => {
    it("produces tiles from the catalog", () => {
      const tiles = buildBentoGrid();
      expect(tiles.length).toBeGreaterThan(0);
    });

    it("assigns exactly one hero tile in CANOPY", () => {
      const tiles = buildBentoGrid();
      const heroes = tiles.filter((t) => t.hero);
      expect(heroes.length).toBe(1);
      expect(heroes[0]!.category).toBe("CANOPY");
    });

    it("every tile has a plan and elevation glyph", () => {
      const tiles = buildBentoGrid();
      for (const t of tiles) {
        expect(t.planGlyph.length).toBeGreaterThan(0);
        expect(t.elevGlyph.length).toBeGreaterThan(0);
      }
    });

    it("tiles are grouped by category in spec order", () => {
      const tiles = buildBentoGrid();
      const cats = [...new Set(tiles.map((t) => t.category))];
      // Categories should appear in the spec order
      const expectedOrder = BENTO_CATEGORIES.filter((c) => tiles.some((t) => t.category === c));
      expect(cats).toEqual(expectedOrder);
    });
  });

  describe("filterBentoByCategory", () => {
    it("filters to a single category", () => {
      const tiles = buildBentoGrid();
      const canopy = filterBentoByCategory(tiles, "CANOPY");
      expect(canopy.every((t) => t.category === "CANOPY")).toBe(true);
    });

    it("returns all for 'all'", () => {
      const tiles = buildBentoGrid();
      expect(filterBentoByCategory(tiles, "all")).toEqual(tiles);
    });
  });

  describe("bentoCategoryCounts", () => {
    it("counts tiles per category", () => {
      const tiles = buildBentoGrid();
      const counts = bentoCategoryCounts(tiles);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(tiles.length);
    });

    it("every category key exists", () => {
      const tiles = buildBentoGrid();
      const counts = bentoCategoryCounts(tiles);
      for (const cat of BENTO_CATEGORIES) {
        expect(counts[cat]).toBeDefined();
      }
    });
  });

  describe("formatDimensions", () => {
    it("formats spread and height", () => {
      expect(
        formatDimensions({
          symbolId: "test",
          label: "Test",
          category: "CANOPY",
          spreadM: 9.0,
          heightM: 14.0,
          planGlyph: "\u2660",
          elevGlyph: "\u2663",
          hero: false,
        }),
      ).toBe("spread 9.0m \u00b7 ht 14.0m");
    });

    it("formats spread only", () => {
      expect(
        formatDimensions({
          symbolId: "test",
          label: "Test",
          category: "HARD",
          spreadM: 0.6,
          planGlyph: "\u25A6",
          elevGlyph: "\u2550",
          hero: false,
        }),
      ).toBe("spread 0.6m");
    });

    it("returns empty string when no dimensions", () => {
      expect(
        formatDimensions({
          symbolId: "test",
          label: "Test",
          category: "SYM",
          planGlyph: "\u25C7",
          elevGlyph: "\u25CB",
          hero: false,
        }),
      ).toBe("");
    });
  });

  describe("bentoTileById", () => {
    it("finds a tile by symbol id", () => {
      const tiles = buildBentoGrid();
      if (tiles.length === 0) return;
      const first = tiles[0]!;
      expect(bentoTileById(tiles, first.symbolId)).toBe(first);
    });

    it("returns undefined for unknown id", () => {
      const tiles = buildBentoGrid();
      expect(bentoTileById(tiles, "nonexistent-id")).toBeUndefined();
    });
  });

  /**
   * Classification regression. `bentoCategoryFor` used to guard on
   * `mapSymbolToStudioType`, which is typed `=> StudioItemType` and ends in
   * `return "canopy"` — so the guard never failed, FURN and SYM were always
   * empty, the annotation exclusion never fired, and benches, bollards and
   * planning hatches were all listed under "Canopy trees".
   */
  describe("category classification (regression)", () => {
    const tiles = buildBentoGrid();
    const idsIn = (cat: BentoCategory) =>
      new Set(filterBentoByCategory(tiles, cat).map((t) => t.symbolId));

    it("files furniture and lighting under FURN, not CANOPY", () => {
      const furn = idsIn("FURN");
      const canopy = idsIn("CANOPY");
      for (const sym of CURTIS_CATALOG_SYMBOLS) {
        if (!isSketchGoldStandard(sym)) continue;
        if (sym.category !== "furniture" && sym.category !== "lighting") continue;
        expect(furn.has(sym.id), `${sym.id} should be FURN`).toBe(true);
        expect(canopy.has(sym.id), `${sym.id} must not be a canopy tree`).toBe(false);
      }
    });

    it("files structures and water under SYM, not CANOPY", () => {
      const sym_ = idsIn("SYM");
      const canopy = idsIn("CANOPY");
      for (const sym of CURTIS_CATALOG_SYMBOLS) {
        if (!isSketchGoldStandard(sym)) continue;
        if (sym.category !== "structure" && sym.category !== "water") continue;
        expect(sym_.has(sym.id), `${sym.id} should be SYM`).toBe(true);
        expect(canopy.has(sym.id), `${sym.id} must not be a canopy tree`).toBe(false);
      }
    });

    it("excludes annotation symbols entirely", () => {
      const all = new Set(tiles.map((t) => t.symbolId));
      for (const sym of CURTIS_CATALOG_SYMBOLS) {
        if (sym.category !== "annotation") continue;
        expect(all.has(sym.id), `${sym.id} is a planning hatch, not an asset`).toBe(
          false,
        );
      }
    });

    it("every canopy tile comes from the planting catalog", () => {
      for (const t of filterBentoByCategory(tiles, "CANOPY")) {
        const sym = CURTIS_CATALOG_SYMBOLS.find((s) => s.id === t.symbolId);
        expect(sym?.category, `${t.symbolId} listed as a canopy tree`).toBe(
          "planting",
        );
      }
    });

    it("FURN and SYM are reachable", () => {
      const counts = bentoCategoryCounts(tiles);
      expect(counts.FURN).toBeGreaterThan(0);
      expect(counts.SYM).toBeGreaterThan(0);
    });
  });
});

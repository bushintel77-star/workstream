import { describe, expect, it } from "vitest";
import {
  buildAssetPalette,
  buildCatalogAssetPalette,
  filterAssetPalette,
} from "./assetPalette";
import { TYPE_TO_SYMBOL, placementsToItems } from "../handoff/state/canvasBridge";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";

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

  it("marks the curated eight as the dock's default face", () => {
    expect(buildAssetPalette().every((e) => e.curated)).toBe(true);
  });

  it("groups by plant type (trees / shrubs / groundcover / hardscape)", () => {
    const palette = buildAssetPalette();
    const byType = new Map(palette.map((e) => [e.type, e.category]));
    expect(byType.get("canopy")).toBe("tree");
    expect(byType.get("hedge")).toBe("shrub");
    expect(byType.get("bed")).toBe("groundcover");
    expect(byType.get("lawn")).toBe("groundcover");
    expect(byType.get("paving")).toBe("hardscape");
  });

  it("filters by category and query without inventing entries", () => {
    const palette = buildAssetPalette();
    expect(filterAssetPalette(palette, { category: "tree" }).every((e) => e.category === "tree")).toBe(true);
    expect(filterAssetPalette(palette, { query: "olea" }).map((e) => e.type)).toEqual(["canopy"]);
    expect(filterAssetPalette(palette, { query: "zzzz" })).toEqual([]);
  });

  it("is deterministic — identical output across calls", () => {
    expect(buildAssetPalette()).toEqual(buildAssetPalette());
  });
});

describe("buildCatalogAssetPalette", () => {
  it("reaches far past the curated eight", () => {
    const full = buildCatalogAssetPalette();
    expect(full.length).toBeGreaterThan(80);
    expect(full.filter((e) => e.curated)).toHaveLength(8);
  });

  it("leads with the curated eight in dock order", () => {
    const full = buildCatalogAssetPalette();
    expect(full.slice(0, 8)).toEqual(buildAssetPalette());
  });

  it("never offers the same symbol twice", () => {
    const ids = buildCatalogAssetPalette().map((e) => e.symbolId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The hydrate guarantee, generalised past TYPE_TO_SYMBOL: a placement is
   * rebuilt by placementsToItems → mapSymbolToStudioType, so every card must
   * advertise the type that function returns. A card that lied here would
   * mint placements that come back as a different thing after a reload.
   */
  it("every entry's type is exactly what placementsToItems rehydrates", () => {
    const full = buildCatalogAssetPalette();
    const placements = full.map((e, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      symbol_id: e.symbolId,
      x_pct: 50,
      y_pct: 50,
      rotation_deg: 0,
      scale: 1,
    }));
    const items = placementsToItems(placements);
    expect(items).toHaveLength(full.length);
    items.forEach((item, i) => {
      expect(item.t).toBe(full[i]!.type);
      expect(item.symbolId).toBe(full[i]!.symbolId);
    });
  });

  it("a non-curated catalog symbol round-trips as its real class, not a canopy", () => {
    const full = buildCatalogAssetPalette();
    const tile = full.find((e) => e.symbolId === "porcelain-tile")!;
    expect(tile.curated).toBe(false);
    expect(tile.category).toBe("hardscape");
    expect(placementsToItems([
      {
        id: "11111111-1111-4111-8111-111111111111",
        symbol_id: "porcelain-tile",
        x_pct: 10,
        y_pct: 20,
        rotation_deg: 0,
        scale: 1,
      },
    ])[0]!.t).toBe("paving");

    const carpet = full.find((e) => e.symbolId === "dichondra-carpet")!;
    expect(carpet.type).toBe("bed");
    expect(mapSymbolToStudioType("dichondra-carpet")).toBe("bed");
  });

  it("withholds symbols the catalog cannot class (no honest studio render)", () => {
    const ids = new Set(buildCatalogAssetPalette().map((e) => e.symbolId));
    // Structures / water / furniture / lighting / planning hatches all
    // hydrate to a coarse plant type — they are not offered at all.
    for (const withheld of [
      "pergola",
      "pool",
      "brass-uplight",
      "planzv-parkanlage",
      "osmic-shop-garden-centre",
    ]) {
      expect(ids.has(withheld)).toBe(false);
    }
    // Existing trees are surveyed, never palette-placed.
    expect(ids.has("existing-tree-retain")).toBe(false);
    expect(ids.has("tree-root-protection")).toBe(false);
  });

  it("carries only real catalog botany on the wider face (never invented)", () => {
    const full = buildCatalogAssetPalette();
    const westringia = full.find((e) => e.symbolId === "westringia-hedge")!;
    expect(westringia.botanicalName).toBe("Westringia fruticosa");
    expect(westringia.spreadM).toBe(2.5);
    // A pack glyph has no botany in the catalog — none is invented for it.
    const packShrub = full.find((e) => e.symbolId === "temaki-shrub")!;
    expect(packShrub.botanicalName).toBeUndefined();
    expect(packShrub.heightM).toBeUndefined();
    expect(packShrub.spreadM).toBe(2.2);
  });

  it("searches label and botanical name across the whole exposed set", () => {
    const full = buildCatalogAssetPalette();
    expect(
      filterAssetPalette(full, { query: "westringia" }).map((e) => e.symbolId),
    ).toContain("westringia-hedge");
    // Botanical-only match — the label says "Mondo grass".
    expect(
      filterAssetPalette(full, { query: "ophiopogon" }).map((e) => e.symbolId),
    ).toEqual(["mondo-edge"]);
    expect(filterAssetPalette(full, { query: "zzzz" })).toEqual([]);
  });

  it("keeps the category chips working on the wider face", () => {
    const full = buildCatalogAssetPalette();
    for (const category of ["tree", "shrub", "groundcover", "hardscape"] as const) {
      const hits = filterAssetPalette(full, { category });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((e) => e.category === category)).toBe(true);
    }
  });

  it("is deterministic — identical output across calls", () => {
    expect(buildCatalogAssetPalette()).toEqual(buildCatalogAssetPalette());
  });
});

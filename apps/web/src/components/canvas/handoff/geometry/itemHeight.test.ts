import { describe, expect, it } from "vitest";
import type { StudioItem, StudioItemType } from "../studioCatalog";
import {
  elevationTagFor,
  hasElevationPresence,
  resolveItemFamily,
  resolveItemHeightGrownM,
  resolveItemHeightM,
  resolveItemMatureHeightM,
  resolveItemSpreadGrownM,
  resolveItemSpreadM,
} from "./itemHeight";

function item(over: Partial<StudioItem> & { t: StudioItemType }): StudioItem {
  return {
    id: "i1",
    x: 50,
    y: 50,
    rot: 0,
    scale: 1,
    ghost: false,
    ...over,
  };
}

describe("resolveItemMatureHeightM", () => {
  it("prefers the hydrated item height", () => {
    expect(
      resolveItemMatureHeightM(
        item({ t: "canopy", heightM: 7.8, symbolId: "olive-standard" }),
      ),
    ).toBe(7.8);
  });

  it("falls back to the placed symbol before the coarse type", () => {
    // BY_TYPE.canopy is 6 m — the symbol must win.
    expect(
      resolveItemMatureHeightM(
        item({ t: "canopy", symbolId: "curtis-tree-780" }),
      ),
    ).toBe(7.8);
    expect(
      resolveItemMatureHeightM(item({ t: "hedge", symbolId: "curtis-hedge-140" })),
    ).toBe(1.4);
    expect(
      resolveItemMatureHeightM(item({ t: "deck", symbolId: "curtis-deck-050" })),
    ).toBe(0.5);
    expect(
      resolveItemMatureHeightM(item({ t: "hedge", symbolId: "olive-standard" })),
    ).toBe(5);
  });

  it("falls back to the coarse type with no symbol", () => {
    expect(resolveItemMatureHeightM(item({ t: "canopy" }))).toBe(6);
    expect(resolveItemMatureHeightM(item({ t: "feature" }))).toBe(4);
    expect(resolveItemMatureHeightM(item({ t: "hedge" }))).toBe(1.2);
    expect(resolveItemMatureHeightM(item({ t: "deck" }))).toBe(0.4);
    expect(resolveItemMatureHeightM(item({ t: "exist" }))).toBe(8);
  });

  it("keeps root-radius-coupled symbols on their coarse type height", () => {
    // These are deliberately heightless in the catalog — see
    // packages/domain/src/catalog-asset-heights.test.ts
    expect(
      resolveItemMatureHeightM(
        item({ t: "exist", symbolId: "existing-tree-retain" }),
      ),
    ).toBe(8);
    expect(
      resolveItemMatureHeightM(
        item({ t: "hedge", symbolId: "hedge-clip-formal" }),
      ),
    ).toBe(1.2);
  });

  it("is zero for flat surfaces so they never draw a profile", () => {
    expect(resolveItemMatureHeightM(item({ t: "lawn" }))).toBe(0);
    expect(resolveItemMatureHeightM(item({ t: "paving" }))).toBe(0);
    expect(
      resolveItemMatureHeightM(item({ t: "paving", symbolId: "bluestone-paver" })),
    ).toBe(0);
    expect(resolveItemMatureHeightM(item({ t: "bed" }))).toBe(0);
  });

  it("ignores a zero or negative hydrated height", () => {
    expect(resolveItemMatureHeightM(item({ t: "canopy", heightM: 0 }))).toBe(6);
    expect(resolveItemMatureHeightM(item({ t: "canopy", heightM: -3 }))).toBe(6);
  });
});

describe("resolveItemHeightM", () => {
  it("applies the placement scale", () => {
    expect(
      resolveItemHeightM(
        item({ t: "canopy", symbolId: "curtis-tree-780", scale: 0.5 }),
      ),
    ).toBe(3.9);
  });

  it("treats a non-positive scale as 1", () => {
    expect(
      resolveItemHeightM(item({ t: "canopy", symbolId: "curtis-tree-780", scale: 0 })),
    ).toBe(7.8);
  });
});

describe("resolveItemHeightGrownM", () => {
  it("scales proposed planting by the growth factor", () => {
    expect(
      resolveItemHeightGrownM(item({ t: "canopy", symbolId: "curtis-tree-780" }), 0.55),
    ).toBeCloseTo(4.29, 5);
  });

  it("never shrinks an existing tree — it is already mature", () => {
    expect(resolveItemHeightGrownM(item({ t: "exist" }), 0.55)).toBe(8);
  });
});

describe("hasElevationPresence", () => {
  it("separates standing assets from flat ones", () => {
    expect(hasElevationPresence(item({ t: "canopy" }))).toBe(true);
    expect(hasElevationPresence(item({ t: "deck" }))).toBe(true);
    expect(hasElevationPresence(item({ t: "lawn" }))).toBe(false);
    expect(hasElevationPresence(item({ t: "paving" }))).toBe(false);
    expect(hasElevationPresence(item({ t: "frenchdrain" }))).toBe(false);
  });
});

describe("resolveItemSpreadM", () => {
  it("prefers the symbol spread, then the type canopy", () => {
    expect(
      resolveItemSpreadM(item({ t: "canopy", symbolId: "curtis-tree-780" })),
    ).toBe(6.5);
    expect(resolveItemSpreadM(item({ t: "canopy" }))).toBe(6);
    expect(resolveItemSpreadM(item({ t: "exist" }))).toBe(7);
  });

  it("is null when nothing knows a metre width", () => {
    expect(resolveItemSpreadM(item({ t: "paving" }))).toBeNull();
    expect(resolveItemSpreadM(item({ t: "lawn" }))).toBeNull();
  });
});

describe("resolveItemSpreadGrownM", () => {
  it("applies placement scale and growth like the height companion", () => {
    expect(
      resolveItemSpreadGrownM(item({ t: "canopy", scale: 0.5 }), 0.5),
    ).toBeCloseTo(1.5, 6);
  });

  it("never shrinks an existing tree — it is already mature", () => {
    expect(resolveItemSpreadGrownM(item({ t: "exist" }), 0.45)).toBe(7);
  });

  it("stays null when nothing knows the spread", () => {
    expect(resolveItemSpreadGrownM(item({ t: "hedge" }), 1)).toBeNull();
  });
});

describe("resolveItemFamily", () => {
  it("takes the family from the symbol when known", () => {
    expect(
      resolveItemFamily(item({ t: "hedge", symbolId: "hornbeam-pleached" })),
    ).toBe("screen");
    expect(
      resolveItemFamily(item({ t: "canopy", symbolId: "curtis-tree-690" })),
    ).toBe("tree");
  });

  it("falls back to the coarse type", () => {
    expect(resolveItemFamily(item({ t: "canopy" }))).toBe("tree");
    expect(resolveItemFamily(item({ t: "exist" }))).toBe("tree");
    expect(resolveItemFamily(item({ t: "hedge" }))).toBe("hedge");
    expect(resolveItemFamily(item({ t: "deck" }))).toBe("deck");
    expect(resolveItemFamily(item({ t: "bed" }))).toBe("shrub");
  });

  it("is null for surfaces with no silhouette", () => {
    expect(resolveItemFamily(item({ t: "paving" }))).toBeNull();
    expect(resolveItemFamily(item({ t: "lawn" }))).toBeNull();
    expect(resolveItemFamily(item({ t: "frenchdrain" }))).toBeNull();
  });
});

describe("elevationTagFor", () => {
  it("names the placed species when a symbol is known", () => {
    expect(elevationTagFor(item({ t: "hedge", symbolId: "hornbeam-pleached" }))).toBe(
      "Pleached hornbeam",
    );
    expect(elevationTagFor(item({ t: "canopy", symbolId: "curtis-tree-780" }))).toBe(
      "Canopy tree · 7.8 m",
    );
  });

  it("falls back to the coarse type tag", () => {
    expect(elevationTagFor(item({ t: "canopy" }))).toBe("Canopy tree");
    expect(elevationTagFor(item({ t: "exist" }))).toBe("Existing tree · DBH 450");
    expect(elevationTagFor(item({ t: "hedge", symbolId: "not-a-symbol" }))).toBe(
      "Hedge",
    );
  });
});

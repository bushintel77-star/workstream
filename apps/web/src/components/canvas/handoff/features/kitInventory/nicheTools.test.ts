import { describe, expect, it } from "vitest";
import type { StudioItem } from "../../studioCatalog";
import {
  nicheActiveIdForItem,
  nicheActiveIdForPlace,
  nicheToolsForItem,
  nicheToolsForPlace,
  nicheVisibleMaterials,
} from "./nicheTools";

function item(partial: Partial<StudioItem> & { t: StudioItem["t"] }): StudioItem {
  return {
    id: "i1",
    x: 40,
    y: 50,
    scale: 1,
    rot: 0,
    ghost: false,
    ...partial,
  };
}

describe("nicheTools", () => {
  it("shows Soft / Hard families above fillable hardscape, not every swatch", () => {
    const tools = nicheToolsForItem(item({ t: "lawn" }), {
      locked: false,
      includeLock: false,
    });
    expect(tools.map((t) => t.id)).toEqual(["bag-soft", "bag-hard"]);
    expect(nicheActiveIdForItem(item({ t: "lawn" }))).toBe("bag-soft");
  });

  it("opens a bag into materials plus back", () => {
    const tools = nicheToolsForItem(item({ t: "lawn" }), {
      locked: false,
      openBag: "soft",
    });
    expect(nicheVisibleMaterials(tools)).toEqual(["lawn", "bed", "hedge"]);
    expect(tools.some((t) => t.id === "bag-back")).toBe(true);
    expect(nicheActiveIdForItem(item({ t: "lawn" }), "soft")).toBe("mat-lawn");
  });

  it("keeps tree siblings short without a bag step", () => {
    const tools = nicheToolsForItem(item({ t: "canopy" }), { locked: false });
    expect(nicheVisibleMaterials(tools)).toEqual(["canopy", "feature"]);
    expect(tools.some((t) => t.kind === "bag")).toBe(false);
  });

  it("keeps existing tree as a mark, not a material swap", () => {
    const tools = nicheToolsForItem(item({ t: "exist" }), { locked: true });
    expect(nicheActiveIdForItem(item({ t: "exist" }))).toBe("exist-mark");
    expect(tools.some((t) => t.id === "exist-mark")).toBe(true);
    expect(tools.find((t) => t.id === "lock")?.label).toBe("Unlock");
  });

  it("place palette uses the same Soft / Hard / Trees / Water bags", () => {
    expect(nicheToolsForPlace("survey").map((t) => t.material)).toEqual([
      "exist",
    ]);
    const root = nicheToolsForPlace("cad");
    expect(root.map((t) => t.id)).toEqual([
      "bag-soft",
      "bag-hard",
      "bag-trees",
      "bag-water",
    ]);
    const soft = nicheToolsForPlace("cad", "soft");
    expect(nicheVisibleMaterials(soft)).toEqual(["lawn", "bed", "hedge"]);
    expect(nicheActiveIdForPlace("lawn", "soft")).toBe("mat-lawn");
    expect(nicheActiveIdForPlace("lawn", null)).toBe("bag-soft");
  });
});

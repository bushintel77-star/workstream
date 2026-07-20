import { describe, expect, it } from "vitest";
import type { StudioItem } from "../../studioCatalog";
import {
  nicheActiveIdForItem,
  nicheToolsForItem,
  nicheToolsForPlace,
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
  it("fans materials above fillable hardscape", () => {
    const tools = nicheToolsForItem(item({ t: "lawn" }), { locked: false });
    const mats = tools.filter((t) => t.kind === "material").map((t) => t.material);
    expect(mats).toContain("lawn");
    expect(mats).toContain("paving");
    expect(mats).toContain("bed");
    expect(tools.some((t) => t.id === "lock")).toBe(true);
  });

  it("keeps existing tree as a mark, not a material swap", () => {
    const tools = nicheToolsForItem(item({ t: "exist" }), { locked: true });
    expect(nicheActiveIdForItem(item({ t: "exist" }))).toBe("exist-mark");
    expect(tools.some((t) => t.id === "exist-mark")).toBe(true);
    expect(tools.find((t) => t.id === "lock")?.label).toBe("Unlock");
  });

  it("place palette includes materials for CAD, only exist for survey", () => {
    expect(nicheToolsForPlace("survey").map((t) => t.material)).toEqual([
      "exist",
    ]);
    const cad = nicheToolsForPlace("cad").map((t) => t.material);
    expect(cad).toContain("lawn");
    expect(cad).toContain("canopy");
    expect(cad).toContain("frenchdrain");
  });
});

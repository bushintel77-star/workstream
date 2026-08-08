import { describe, expect, it } from "vitest";
import type { StudioItem } from "../../studioCatalog";
import { buildTreesLiveMeta, selectExistTrees } from "./treesLiveMeta";

function tree(partial: Partial<StudioItem> & { id: string }): StudioItem {
  return {
    t: "exist",
    x: 40,
    y: 50,
    rot: 0,
    scale: 1,
    ghost: false,
    ...partial,
  };
}

describe("buildTreesLiveMeta", () => {
  it("counts existing (non-ghost) trees and flags TPZ from DBH", () => {
    const items: StudioItem[] = [
      tree({ id: "e1", dbhM: 0.45 }),
      tree({ id: "e2" }),
      tree({ id: "g1", ghost: true, dbhM: 0.3 }),
      { ...tree({ id: "c1" }), t: "canopy" },
    ];
    const meta = buildTreesLiveMeta({ items });
    expect(meta.count).toBe(2);
    expect(meta.tpzCount).toBe(1);
    expect(meta.face).toBe("Trees · 2");
    expect(meta.detail).toMatch(/1 NRZ · AS 4970-2025/);
    // AS 4970-2025 NRZ = 12 × 0.45 = 5.4 m
    expect(meta.trees[0]?.tpzRadiusM).toBeCloseTo(5.4, 5);
  });

  it("reads no survey trees when none exist", () => {
    const meta = buildTreesLiveMeta({ items: [] });
    expect(meta.count).toBe(0);
    expect(meta.face).toBe("Trees · 0");
    expect(meta.detail).toMatch(/No survey trees/);
  });

  it("selectExistTrees enforces a minimum 2 m TPZ radius", () => {
    const trees = selectExistTrees([tree({ id: "e1", dbhM: 0.1 })]);
    expect(trees[0]?.tpzRadiusM).toBe(2);
  });
});

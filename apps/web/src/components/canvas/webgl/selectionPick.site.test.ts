import { describe, expect, it } from "vitest";
import {
  boundaryHitTest,
  buildingHitTest,
  pruneSelection,
  type SelectionRef,
} from "./selectionPick";
import { resolvePanelContext } from "./UnifiedPanel";

const RING = [
  { x: 20, y: 15 },
  { x: 80, y: 15 },
  { x: 80, y: 85 },
  { x: 20, y: 85 },
];

const BUILDING = [
  { x: 35, y: 20 },
  { x: 65, y: 20 },
  { x: 65, y: 35 },
  { x: 35, y: 35 },
];

describe("boundaryHitTest", () => {
  it("hits on the ring line within the grab radius", () => {
    expect(boundaryHitTest(RING, { x: 20, y: 50 }, 100)).toBe(true); // left edge
    expect(boundaryHitTest(RING, { x: 50, y: 15 }, 100)).toBe(true); // top edge
    expect(boundaryHitTest(RING, { x: 80, y: 50 }, 100)).toBe(true); // right edge
  });

  it("misses in the lot interior (far from any edge)", () => {
    expect(boundaryHitTest(RING, { x: 50, y: 50 }, 100)).toBe(false);
  });

  it("misses outside the boundary", () => {
    expect(boundaryHitTest(RING, { x: 95, y: 50 }, 100)).toBe(false);
  });

  it("returns false for degenerate rings", () => {
    expect(boundaryHitTest([], { x: 50, y: 50 }, 100)).toBe(false);
    expect(boundaryHitTest([{ x: 1, y: 1 }], { x: 50, y: 50 }, 100)).toBe(false);
  });
});

describe("buildingHitTest", () => {
  it("hits on the building footprint outline", () => {
    expect(buildingHitTest(BUILDING, { x: 35, y: 27 }, 100)).toBe(true); // left edge
    expect(buildingHitTest(BUILDING, { x: 50, y: 20 }, 100)).toBe(true); // top edge
  });

  it("misses outside the footprint and in empty interior", () => {
    expect(buildingHitTest(BUILDING, { x: 50, y: 70 }, 100)).toBe(false); // below building
  });
});

describe("pruneSelection with site elements", () => {
  it("boundary/building refs survive while their geometry exists", () => {
    const refs: SelectionRef[] = [
      { kind: "boundary", id: "site-boundary" },
      { kind: "building", id: "site-building" },
      { kind: "placement", id: "gone" },
    ];
    const pruned = pruneSelection(refs, {
      placements: [],
      features: [],
      photoElevations: [],
      siteBoundary: RING,
      siteBuilding: BUILDING,
    });
    expect(pruned).toHaveLength(2);
    expect(pruned.map((r) => r.kind)).toEqual(["boundary", "building"]);
  });

  it("site element refs pruned when geometry is empty", () => {
    const refs: SelectionRef[] = [{ kind: "boundary", id: "site-boundary" }];
    const pruned = pruneSelection(refs, {
      placements: [],
      features: [],
      photoElevations: [],
      siteBoundary: [],
    });
    expect(pruned).toHaveLength(0);
  });
});

describe("resolvePanelContext (the context router)", () => {
  it("selection wins over everything", () => {
    expect(resolvePanelContext([{ kind: "boundary", id: "b" }], true, "cad"))
      .toEqual({ kind: "selection-boundary", ref: { kind: "boundary", id: "b" } });
    expect(resolvePanelContext([{ kind: "placement", id: "p1" }], false, "survey"))
      .toEqual({ kind: "selection-placement", ref: { kind: "placement", id: "p1" } });
  });

  it("multi-select returns selection-multi", () => {
    expect(
      resolvePanelContext(
        [
          { kind: "placement", id: "a" },
          { kind: "feature", id: "b" },
        ],
        false,
        "cad",
      ).kind,
    ).toBe("selection-multi");
  });

  it("tool-armed wins over mode when no selection", () => {
    expect(resolvePanelContext([], true, "survey").kind).toBe("tool-sketch");
  });

  it("mode is the default", () => {
    expect(resolvePanelContext([], false, "survey").kind).toBe("mode-survey");
    expect(resolvePanelContext([], false, "cad").kind).toBe("mode-cad");
    expect(resolvePanelContext([], false, "quote").kind).toBe("mode-quote");
  });
});

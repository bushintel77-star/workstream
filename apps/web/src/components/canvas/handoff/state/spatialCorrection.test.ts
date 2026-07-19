import { describe, expect, it } from "vitest";
import type { StudioItem } from "../studioCatalog";
import {
  clampVegetationElevationScale,
  clearBoundaryLikeSketches,
  isSpatialCorrectionQuery,
  isStage1FoundationQuery,
  purgeGhostItems,
  purgeVegetationItems,
  sieveVegetationItems,
} from "./spatialCorrection";
import { canvasMetresRingToPct } from "../geometry/geoToPct";

describe("sieveVegetationItems", () => {
  it("removes overlapping proposed canopies", () => {
    const items: StudioItem[] = [
      { id: "a", t: "canopy", x: 40, y: 50, rot: 0, scale: 1, ghost: false },
      { id: "b", t: "canopy", x: 40.5, y: 50.2, rot: 0, scale: 1, ghost: true },
      { id: "p", t: "paving", x: 50, y: 50, rot: 0, scale: 1, ghost: false },
    ];
    const { items: next, removed } = sieveVegetationItems(items);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(next.some((i) => i.t === "paving")).toBe(true);
    expect(next.filter((i) => i.t === "canopy")).toHaveLength(1);
  });
});

describe("clampVegetationElevationScale", () => {
  it("caps scale above 1 for canopy", () => {
    const { items, clamped } = clampVegetationElevationScale([
      { id: "c", t: "canopy", x: 40, y: 50, rot: 0, scale: 2.2, ghost: false },
    ]);
    expect(clamped).toBe(1);
    expect(items[0]!.scale).toBe(1);
  });
});

describe("isSpatialCorrectionQuery", () => {
  it("matches cadastral / sieve phrases", () => {
    expect(isSpatialCorrectionQuery("snap to title Vicmap")).toBe(true);
    expect(isSpatialCorrectionQuery("drop aerial parchment only")).toBe(true);
    expect(isSpatialCorrectionQuery("shade the west glazing")).toBe(false);
  });

  it("defers Stage 1 phrases to foundation detector", () => {
    expect(isSpatialCorrectionQuery("Stage 1 cadastral foundation")).toBe(
      false,
    );
  });
});

describe("isStage1FoundationQuery", () => {
  it("matches foundation cleanse / Vicmap title phrases", () => {
    expect(isStage1FoundationQuery("Stage 1 cadastral foundation cleanse")).toBe(
      true,
    );
    expect(isStage1FoundationQuery("purge aerial and vegetation")).toBe(true);
    expect(isStage1FoundationQuery("authoritative title Vicmap")).toBe(true);
    expect(isStage1FoundationQuery("to-scale 2D CAD title")).toBe(true);
    expect(isStage1FoundationQuery("shade the west glazing")).toBe(false);
  });
});

describe("purgeVegetationItems", () => {
  it("removes all softscape types", () => {
    const { items, removed } = purgeVegetationItems([
      { id: "a", t: "canopy", x: 40, y: 50, rot: 0, scale: 1, ghost: false },
      { id: "b", t: "bed", x: 42, y: 51, rot: 0, scale: 1, ghost: false },
      { id: "c", t: "paving", x: 50, y: 50, rot: 0, scale: 1, ghost: false },
    ]);
    expect(removed).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0]!.t).toBe("paving");
  });
});

describe("purgeGhostItems", () => {
  it("drops ghosts only", () => {
    const { items, removed } = purgeGhostItems([
      { id: "a", t: "paving", x: 40, y: 50, rot: 0, scale: 1, ghost: true },
      { id: "b", t: "deck", x: 42, y: 51, rot: 0, scale: 1, ghost: false },
    ]);
    expect(removed).toBe(1);
    expect(items).toHaveLength(1);
  });
});

describe("clearBoundaryLikeSketches", () => {
  it("clears all when clearAll", () => {
    const { strokes, cleared } = clearBoundaryLikeSketches(
      [
        {
          id: "s1",
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
          ],
        },
      ],
      [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
      ],
      { clearAll: true },
    );
    expect(cleared).toBe(1);
    expect(strokes).toHaveLength(0);
  });
});

describe("canvasMetresRingToPct", () => {
  it("maps a metre square into padded % board", () => {
    const pct = canvasMetresRingToPct([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]);
    expect(pct).toHaveLength(4);
    expect(Math.min(...pct.map((p) => p.x))).toBeGreaterThanOrEqual(7);
    expect(Math.max(...pct.map((p) => p.x))).toBeLessThanOrEqual(93);
  });
});

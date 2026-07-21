import { describe, expect, it } from "vitest";
import {
  isPointInOutdoor,
  nearestPointOnRing,
  outdoorFocusView,
  sanitizeItemsToOutdoor,
  snapPointToOutdoor,
} from "./outdoorClamp";
import type { StudioItem } from "../studioCatalog";

/** Square lot 10–90, house sitting in the middle. */
const LOT: { x: number; y: number }[] = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];
const HOUSE: { x: number; y: number }[] = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 65 },
  { x: 35, y: 65 },
];

describe("isPointInOutdoor", () => {
  it("accepts backyard / side yard points", () => {
    expect(isPointInOutdoor({ x: 50, y: 80 }, LOT, HOUSE)).toBe(true);
    expect(isPointInOutdoor({ x: 20, y: 50 }, LOT, HOUSE)).toBe(true);
  });

  it("rejects outside the title and inside the house", () => {
    expect(isPointInOutdoor({ x: 5, y: 50 }, LOT, HOUSE)).toBe(false);
    expect(isPointInOutdoor({ x: 50, y: 50 }, LOT, HOUSE)).toBe(false);
  });
});

describe("snapPointToOutdoor", () => {
  it("leaves outdoor points alone", () => {
    const r = snapPointToOutdoor({ x: 50, y: 78 }, LOT, HOUSE);
    expect(r.snapped).toBe(false);
    expect(r.x).toBe(50);
    expect(r.y).toBe(78);
  });

  it("pulls points outside the lot into the parcel", () => {
    const r = snapPointToOutdoor({ x: 2, y: 50 }, LOT, HOUSE);
    expect(r.snapped).toBe(true);
    expect(isPointInOutdoor({ x: r.x, y: r.y }, LOT, HOUSE)).toBe(true);
  });

  it("pushes points out of the housing envelope into outdoor", () => {
    const r = snapPointToOutdoor({ x: 50, y: 50 }, LOT, HOUSE);
    expect(r.snapped).toBe(true);
    expect(isPointInOutdoor({ x: r.x, y: r.y }, LOT, HOUSE)).toBe(true);
  });
});

describe("nearestPointOnRing", () => {
  it("projects onto the nearest edge", () => {
    const q = nearestPointOnRing({ x: 50, y: 0 }, LOT);
    expect(q.y).toBeCloseTo(10, 5);
    expect(q.x).toBeCloseTo(50, 5);
  });
});

describe("sanitizeItemsToOutdoor", () => {
  it("relocates stray hedges / lawn into outdoor", () => {
    const items: StudioItem[] = [
      {
        id: "1",
        t: "hedge",
        x: 3,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
      },
      {
        id: "2",
        t: "lawn",
        x: 50,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
      },
      {
        id: "3",
        t: "canopy",
        x: 50,
        y: 82,
        rot: 0,
        scale: 1,
        ghost: false,
      },
    ];
    const next = sanitizeItemsToOutdoor(items, LOT, HOUSE);
    expect(isPointInOutdoor({ x: next[0]!.x, y: next[0]!.y }, LOT, HOUSE)).toBe(
      true,
    );
    expect(isPointInOutdoor({ x: next[1]!.x, y: next[1]!.y }, LOT, HOUSE)).toBe(
      true,
    );
    expect(next[2]!.x).toBe(50);
    expect(next[2]!.y).toBe(82);
  });
});

describe("outdoorFocusView", () => {
  it("centres on the outdoor remnant and zooms in", () => {
    const v = outdoorFocusView(LOT, HOUSE, 100);
    expect(v.focusX).toBeGreaterThan(30);
    expect(v.focusX).toBeLessThan(70);
    expect(v.zoom).toBeGreaterThanOrEqual(1);
  });

  it("allows fit zoom beyond the old 2.6 ceiling on a tight remnant", () => {
    // Compact lot — fill ~90% → zoom past the legacy 2.6 fit cap.
    const tight = [
      { x: 45, y: 45 },
      { x: 55, y: 45 },
      { x: 55, y: 55 },
      { x: 45, y: 55 },
    ];
    const v = outdoorFocusView(tight, [], 100);
    expect(v.zoom).toBeGreaterThan(2.6);
    expect(v.zoom).toBeLessThanOrEqual(16);
  });
});

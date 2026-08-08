import { describe, expect, it } from "vitest";
import {
  deckElevGeometry,
  hasGardenSilhouette,
  hedgeElevGeometry,
  screenElevGeometry,
  shrubElevGeometry,
  treeElevGeometry,
  type ElevBox,
} from "./gardenElevationGeometry";

/** A 7.8 m tree bar on the board: ground at y+h = 36. */
const tall: ElevBox = { x: 20, y: 6, w: 6, h: 30 };
/** A 1.2 m hedge bar. */
const low: ElevBox = { x: 50, y: 31, w: 2, h: 5 };

const GROUND = tall.y + tall.h;

describe("treeElevGeometry", () => {
  it("stands the trunk on the ground and the crown on the trunk", () => {
    const g = treeElevGeometry(tall);
    expect(g.groundY).toBe(GROUND);
    expect(g.trunkTopY).toBeLessThan(g.groundY);
    // Crown bottom meets the trunk top — no floating canopy, no gap.
    expect(g.crownCy + g.crownRy).toBeCloseTo(g.trunkTopY, 6);
  });

  it("fills the bar exactly — crown top is the bar top", () => {
    const g = treeElevGeometry(tall);
    expect(g.crownCy - g.crownRy).toBeCloseTo(tall.y, 6);
    expect(g.crownTopY).toBe(tall.y);
  });

  it("centres the trunk and the crown in the bar", () => {
    const g = treeElevGeometry(tall);
    expect(g.centreX).toBe(23);
    expect(g.crownCx).toBe(23);
    expect(g.crownRx).toBe(3);
  });

  it("keeps the trunk visible even in a hairline bar", () => {
    expect(treeElevGeometry({ x: 0, y: 0, w: 0.6, h: 10 }).trunkW).toBe(0.25);
    // Never wider than the bar itself.
    expect(treeElevGeometry({ x: 0, y: 0, w: 0.1, h: 10 }).trunkW).toBeCloseTo(
      0.1,
      6,
    );
  });

  it("grows monotonically with bar height", () => {
    const short = treeElevGeometry({ ...tall, h: 10 });
    const high = treeElevGeometry({ ...tall, h: 30 });
    expect(high.crownRy).toBeGreaterThan(short.crownRy);
  });

  it("survives a degenerate bar without NaN", () => {
    const g = treeElevGeometry({ x: 5, y: 5, w: 0, h: 0 });
    for (const v of Object.values(g)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("screenElevGeometry", () => {
  it("lifts the foliage panel clear of the ground on a stem", () => {
    const g = screenElevGeometry(tall);
    expect(g.groundY).toBe(GROUND);
    expect(g.stemTopY).toBeLessThan(g.groundY);
    // Panel sits on the stem top and reaches the bar top.
    expect(g.panel.y + g.panel.h).toBeCloseTo(g.stemTopY, 6);
    expect(g.panel.y).toBe(tall.y);
  });

  it("keeps the panel inside the bar width", () => {
    const g = screenElevGeometry(tall);
    expect(g.panel.x).toBe(tall.x);
    expect(g.panel.w).toBe(tall.w);
  });
});

describe("hedgeElevGeometry", () => {
  it("fills the bar from the ground up", () => {
    const g = hedgeElevGeometry(low);
    expect(g.groundY).toBe(low.y + low.h);
    expect(g.block).toEqual(low);
  });

  it("spaces clip ticks inside the block, never on the edges", () => {
    const g = hedgeElevGeometry(low);
    expect(g.tickXs).toHaveLength(4);
    for (const x of g.tickXs) {
      expect(x).toBeGreaterThan(low.x);
      expect(x).toBeLessThan(low.x + low.w);
    }
    // Evenly spaced.
    const gaps = g.tickXs.slice(1).map((x, i) => x - g.tickXs[i]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
  });

  it("keeps ticks and the clip line proportionate to a short bar", () => {
    const g = hedgeElevGeometry(low);
    expect(g.tickR).toBeGreaterThan(0);
    expect(g.tickR).toBeLessThanOrEqual(low.h * 0.12);
    expect(g.clipLineY).toBeGreaterThan(low.y);
    expect(g.clipLineY).toBeLessThan(low.y + low.h);
  });
});

describe("shrubElevGeometry", () => {
  it("domes up from the ground line", () => {
    const g = shrubElevGeometry(low);
    expect(g.cy).toBe(low.y + low.h);
    expect(g.ry).toBe(low.h);
    expect(g.rx).toBe(low.w / 2);
    // Dome apex is the bar top.
    expect(g.cy - g.ry).toBeCloseTo(low.y, 6);
  });
});

describe("deckElevGeometry", () => {
  const deck: ElevBox = { x: 10, y: 33, w: 12, h: 3 };

  it("stacks plate, fascia and posts down to the ground", () => {
    const g = deckElevGeometry(deck);
    expect(g.groundY).toBe(36);
    expect(g.plate.y).toBe(deck.y);
    // Fascia hangs directly off the plate.
    expect(g.fascia.y).toBeCloseTo(g.plate.y + g.plate.h, 6);
    // Posts start where the plate assembly ends and run to the ground.
    expect(g.postTopY).toBeCloseTo(g.fascia.y + g.fascia.h, 6);
    expect(g.postTopY).toBeLessThan(g.groundY);
  });

  it("insets the posts so they read as supports, not edges", () => {
    const g = deckElevGeometry(deck);
    expect(g.postXs).toHaveLength(2);
    for (const x of g.postXs) {
      expect(x).toBeGreaterThan(deck.x);
      expect(x).toBeLessThan(deck.x + deck.w);
    }
    expect(g.postW).toBeGreaterThan(0);
  });

  it("draws board joints inside the plate", () => {
    const g = deckElevGeometry(deck);
    for (const y of g.boardYs) {
      expect(y).toBeGreaterThan(g.plate.y);
      expect(y).toBeLessThan(g.plate.y + g.plate.h);
    }
  });

  it("keeps the whole assembly inside the bar", () => {
    const g = deckElevGeometry(deck);
    expect(g.plate.y).toBeGreaterThanOrEqual(deck.y);
    expect(g.fascia.y + g.fascia.h).toBeLessThanOrEqual(g.groundY);
  });
});

describe("hasGardenSilhouette", () => {
  it("is true for the five garden families", () => {
    expect(hasGardenSilhouette("tree")).toBe(true);
    expect(hasGardenSilhouette("screen")).toBe(true);
    expect(hasGardenSilhouette("hedge")).toBe(true);
    expect(hasGardenSilhouette("shrub")).toBe(true);
    expect(hasGardenSilhouette("deck")).toBe(true);
  });

  it("is false for structures and fixtures — they keep the plain profile", () => {
    expect(hasGardenSilhouette(null)).toBe(false);
    expect(hasGardenSilhouette(undefined)).toBe(false);
  });
});

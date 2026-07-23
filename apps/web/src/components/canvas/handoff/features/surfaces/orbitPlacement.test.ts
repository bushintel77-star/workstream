import { describe, expect, it } from "vitest";
import {
  angleDeg,
  angularDistanceDeg,
  bestHalfWindow,
  clampWindowToViewport,
  normalizeDeg,
  scoreSectors,
  sectorOf,
  shouldRelocate,
} from "./orbitPlacement";

describe("angles", () => {
  it("uses screen convention (y down): right 0, down 90, left 180, up 270", () => {
    const c = { x: 50, y: 50 };
    expect(angleDeg(c, { x: 60, y: 50 })).toBe(0);
    expect(angleDeg(c, { x: 50, y: 60 })).toBe(90);
    expect(angleDeg(c, { x: 40, y: 50 })).toBe(180);
    expect(angleDeg(c, { x: 50, y: 40 })).toBe(270);
  });

  it("sectors partition the circle around their centres", () => {
    expect(sectorOf(0)).toBe(0);
    expect(sectorOf(44)).toBe(1);
    expect(sectorOf(90)).toBe(2);
    expect(sectorOf(359)).toBe(0);
    expect(normalizeDeg(-90)).toBe(270);
  });

  it("angular distance wraps", () => {
    expect(angularDistanceDeg(350, 10)).toBe(20);
    expect(angularDistanceDeg(0, 180)).toBe(180);
  });
});

describe("scoreSectors + bestHalfWindow", () => {
  it("chooses the empty side of a lopsided scene", () => {
    const centre = { x: 50, y: 50 };
    // Crowd everything ABOVE the selection (up = 270).
    const scores = scoreSectors(centre, {
      points: [
        { x: 50, y: 35 },
        { x: 45, y: 38 },
        { x: 55, y: 37 },
      ],
    });
    const win = bestHalfWindow(scores);
    // The empty window should face DOWN (90) — away from the crowd.
    expect(angularDistanceDeg(win.centerDeg, 90)).toBeLessThanOrEqual(45);
  });

  it("polylines weigh their whole length, not just vertices", () => {
    const centre = { x: 50, y: 50 };
    // A long line passing to the LEFT of the selection.
    const scores = scoreSectors(centre, {
      polylines: [{ points: [{ x: 40, y: 20 }, { x: 40, y: 80 }] }],
    });
    const left = scores[4]!; // sector centred on 180
    const right = scores[0]!; // sector centred on 0
    expect(left).toBeGreaterThan(right);
    const win = bestHalfWindow(scores);
    expect(angularDistanceDeg(win.centerDeg, 0)).toBeLessThanOrEqual(90);
  });

  it("empty scene ties resolve toward below-the-object (90)", () => {
    const win = bestHalfWindow(new Array(8).fill(0));
    // Window centres land on 45° lattice; closest-to-90 ties prefer the
    // first (67.5°) over 112.5° — both 22.5° from down.
    expect(angularDistanceDeg(win.centerDeg, 90)).toBeLessThanOrEqual(22.5);
    expect(win.score).toBe(0);
  });

  it("far content is ignored (falloff horizon)", () => {
    const centre = { x: 50, y: 50 };
    const scores = scoreSectors(centre, {
      points: [{ x: 50, y: 95 }], // 45% away — beyond the 28% horizon
    });
    expect(scores.every((s) => s === 0)).toBe(true);
  });
});

describe("shouldRelocate (hysteresis)", () => {
  it("never relocates for small angular shifts", () => {
    expect(
      shouldRelocate(
        { centerDeg: 90, score: 10 },
        { centerDeg: 120, score: 1 },
      ),
    ).toBe(false);
  });

  it("relocates only when meaningfully emptier", () => {
    const current = { centerDeg: 90, score: 10 };
    expect(shouldRelocate(current, { centerDeg: 270, score: 8 })).toBe(false);
    expect(shouldRelocate(current, { centerDeg: 270, score: 6 })).toBe(true);
  });

  it("stays put when the current side is already empty", () => {
    expect(
      shouldRelocate(
        { centerDeg: 90, score: 0 },
        { centerDeg: 270, score: 0 },
      ),
    ).toBe(false);
  });
});

describe("clampWindowToViewport", () => {
  it("keeps the window when the arc fits", () => {
    expect(
      clampWindowToViewport({
        centerDeg: 90,
        selectionPx: { x: 500, y: 300 },
        radiusPx: 100,
        viewport: { w: 1200, h: 800 },
      }),
    ).toBe(90);
  });

  it("points at the viewport centre when the arc would overflow", () => {
    const adjusted = clampWindowToViewport({
      centerDeg: 90, // downward, but the selection is near the bottom edge
      selectionPx: { x: 600, y: 780 },
      radiusPx: 100,
      viewport: { w: 1200, h: 800 },
    });
    // Must now point up-ish (toward centre), not down.
    expect(angularDistanceDeg(adjusted, 270)).toBeLessThan(90);
  });
});

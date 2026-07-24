import { describe, expect, it } from "vitest";
import { bufferPolylineToRing, clipPolylineToBbox } from "./bufferPolyline";

describe("bufferPolylineToRing", () => {
  it("buffers a horizontal segment into a 2×halfWidth rectangle", () => {
    const ring = bufferPolylineToRing(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      0.9,
    );
    expect(ring).toHaveLength(4);
    const xs = ring.map((p) => p.x);
    const ys = ring.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(10);
    expect(Math.min(...ys)).toBeCloseTo(-0.9);
    expect(Math.max(...ys)).toBeCloseTo(0.9);
  });

  it("keeps corridor width at a right-angle join (miter ≤ limit)", () => {
    const ring = bufferPolylineToRing(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      1,
    );
    expect(ring).toHaveLength(6);
    // Ring is left chain (0..2) then reversed right chain (3..5); the join's
    // offsets are at indices 1 and 4. Miter at 90° = 1/cos(45°) = √2.
    for (const corner of [ring[1]!, ring[4]!]) {
      expect(Math.hypot(corner.x - 10, corner.y - 0)).toBeCloseTo(
        Math.SQRT2,
        5,
      );
    }
  });

  it("clips a block-long line to the box before it can distort", () => {
    const box = { minX: 0, maxX: 20, minY: 0, maxY: 20 };
    const runs = clipPolylineToBbox(
      [
        { x: 10, y: -50 },
        { x: 10, y: 80 },
      ],
      box,
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ]);
  });

  it("splits into runs when the line exits and re-enters", () => {
    const box = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    // W-shaped path dips below the box between two inside sections.
    const runs = clipPolylineToBbox(
      [
        { x: 1, y: 5 },
        { x: 3, y: -5 },
        { x: 5, y: 5 },
      ],
      box,
    );
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.length).toBeGreaterThanOrEqual(2);
      for (const p of run) {
        expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it("drops lines fully outside the box", () => {
    expect(
      clipPolylineToBbox(
        [
          { x: -5, y: -5 },
          { x: -1, y: -1 },
        ],
        { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      ),
    ).toEqual([]);
  });

  it("returns empty for degenerate input", () => {
    expect(bufferPolylineToRing([], 1)).toEqual([]);
    expect(bufferPolylineToRing([{ x: 1, y: 1 }], 1)).toEqual([]);
    expect(
      bufferPolylineToRing(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        1,
      ),
    ).toEqual([]);
    expect(
      bufferPolylineToRing(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        0,
      ),
    ).toEqual([]);
  });
});

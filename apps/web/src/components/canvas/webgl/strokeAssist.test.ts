import { describe, expect, it } from "vitest";
import {
  stabilizePoint,
  shouldStraighten,
  straightenStroke,
  straightness,
  STRAIGHTEN_HOLD_MS,
} from "./strokeAssist";

describe("stabilizePoint (pull-chain stabilizer)", () => {
  it("passes points through untouched at strength 0 (today's behaviour)", () => {
    const state = { last: null };
    const a = stabilizePoint({ x: 1, y: 2 }, state, 0);
    const b = stabilizePoint({ x: 5, y: 9 }, state, 0);
    expect(a).toEqual({ x: 1, y: 2 });
    expect(b).toEqual({ x: 5, y: 9 });
  });

  it("seeds the chain with the first raw point at any strength", () => {
    const state = { last: null };
    const p = stabilizePoint({ x: 3, y: 4 }, state, 0.8);
    expect(p).toEqual({ x: 3, y: 4 });
    expect(state.last).toEqual({ x: 3, y: 4 });
  });

  it("damps the jump toward a far raw point but never freezes (strength 1)", () => {
    const state = { last: { x: 0, y: 0 } };
    const p = stabilizePoint({ x: 10, y: 0 }, state, 1);
    // follow floor 0.15 → the chain moves 15% of the way, not 0, not 100%.
    expect(p.x).toBeCloseTo(1.5, 10);
    expect(p.y).toBe(0);
  });

  it("converges to the pen when the pen holds (the chain catches up)", () => {
    const state = { last: { x: 0, y: 0 } };
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 60; i += 1) {
      p = stabilizePoint({ x: 5, y: 0 }, state, 0.6);
    }
    expect(p.x).toBeGreaterThan(4.9);
  });

  it("clamps out-of-range strengths", () => {
    const state = { last: { x: 0, y: 0 } };
    const a = stabilizePoint({ x: 10, y: 0 }, state, 7);
    expect(a.x).toBeCloseTo(1.5, 10); // treated as 1
  });
});

describe("shouldStraighten (hold-to-straighten gate)", () => {
  const line = [
    { x: 0, y: 0 },
    { x: 1, y: 0.02 },
    { x: 2, y: -0.01 },
    { x: 3, y: 0 },
  ];
  const curve = [
    { x: 0, y: 0 },
    { x: 0.1, y: 1 },
    { x: 1, y: 1.6 },
    { x: 2, y: 1 },
    { x: 2.1, y: 0 },
  ];

  it("straightens a line-intending stroke after a deliberate hold", () => {
    expect(shouldStraighten(line, STRAIGHTEN_HOLD_MS + 50)).toBe(true);
  });

  it("does not straighten a lift without a hold (mid-flow lift)", () => {
    expect(shouldStraighten(line, 100)).toBe(false);
  });

  it("does not straighten a curve that pauses — curves stay curves", () => {
    expect(shouldStraighten(curve, 10_000)).toBe(false);
  });

  it("does not straighten a single point", () => {
    expect(shouldStraighten([{ x: 0, y: 0 }], 10_000)).toBe(false);
  });
});

describe("straightenStroke (chord + 15° snap)", () => {
  it("returns exactly the two chord endpoints for a generic angle", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0.34 },
      { x: 2, y: 0.75 },
    ]; // ~20.6° — >5° from both 15° and 30°, so no snap
    const out = straightenStroke(pts);
    expect(out).toHaveLength(2);
    expect(out[0]!).toEqual({ x: 0, y: 0 });
    expect(out[1]!.x).toBeCloseTo(2, 5);
    expect(out[1]!.y).toBeCloseTo(0.75, 5);
  });

  it("snaps a near-horizontal wobble to exactly horizontal, keeping length", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0.05 },
      { x: 2, y: -0.04 },
      { x: 4, y: 0.02 },
    ]; // ~0.3° off 0°
    const out = straightenStroke(pts);
    expect(out[1]!.y).toBeCloseTo(0, 10);
    expect(Math.hypot(out[1]!.x, out[1]!.y)).toBeCloseTo(
      Math.hypot(4, 0.02),
      5,
    );
  });

  it("snaps to the nearest 45° diagonal when within tolerance", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 3, y: 3.2 },
    ]; // ~46.8° — within 5° of 45°
    const out = straightenStroke(pts);
    expect(out[1]!.y).toBeCloseTo(out[1]!.x, 6);
    expect(Math.hypot(out[1]!.x, out[1]!.y)).toBeCloseTo(
      Math.hypot(3, 3.2),
      5,
    );
  });

  it("preserves the start point exactly and survives a zero-length chord", () => {
    const out = straightenStroke([{ x: 2, y: 2 }, { x: 2, y: 2 }]);
    expect(out).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ]);
  });
});

describe("straightness", () => {
  it("is 1 for a straight run and lower for a curve", () => {
    expect(
      straightness([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toBe(1);
    expect(
      straightness([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]),
    ).toBeLessThan(1);
  });
});

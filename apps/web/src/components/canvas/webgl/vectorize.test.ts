/**
 * Trace & Bake vectorization — Douglas-Peucker + centripetal Catmull-Rom.
 */

import { describe, expect, it } from "vitest";
import {
  catmullRomToCubic,
  simplifyDouglasPeucker,
  vectorizeStroke,
} from "./vectorize";
import type { PctPoint } from "./coordTransform";

describe("simplifyDouglasPeucker", () => {
  it("collapses a perfectly straight polyline to its endpoints", () => {
    const pts: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    const out = simplifyDouglasPeucker(pts, 0.5);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1]).toEqual({ x: 40, y: 0 });
  });

  it("keeps a sharp corner", () => {
    const pts: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ];
    const out = simplifyDouglasPeucker(pts, 0.5);
    expect(out).toHaveLength(3);
  });

  it("drops a small deviation below epsilon but keeps a large one", () => {
    const base: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const smallWobble: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0.2 },
      { x: 100, y: 0 },
    ];
    const bigWobble: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 5 },
      { x: 100, y: 0 },
    ];
    expect(simplifyDouglasPeucker(smallWobble, 1)).toHaveLength(2);
    expect(simplifyDouglasPeucker(bigWobble, 1)).toHaveLength(3);
    expect(simplifyDouglasPeucker(base, 1)).toHaveLength(2);
  });

  it("short inputs pass through", () => {
    const pts: PctPoint[] = [{ x: 1, y: 2 }];
    expect(simplifyDouglasPeucker(pts)).toEqual(pts);
  });
});

describe("catmullRomToCubic", () => {
  it("open curve: one cubic per input segment, endpoints hit the input", () => {
    const pts: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ];
    const segs = catmullRomToCubic(pts, false);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.c0).toEqual({ x: 0, y: 0 });
    expect(segs[0]!.c3).toEqual({ x: 10, y: 5 });
    expect(segs[1]!.c0).toEqual({ x: 10, y: 5 });
    expect(segs[1]!.c3).toEqual({ x: 20, y: 0 });
  });

  it("closed curve wraps the ring (one segment per vertex)", () => {
    const pts: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const segs = catmullRomToCubic(pts, true);
    expect(segs).toHaveLength(4);
    expect(segs[3]!.c3).toEqual({ x: 0, y: 0 });
    expect(segs[0]!.c0).toEqual({ x: 0, y: 0 });
  });

  it("two points produce a straight midpoint segment", () => {
    const segs = catmullRomToCubic(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      false,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]!.c1).toEqual({ x: 5, y: 0 });
    expect(segs[0]!.c2).toEqual({ x: 5, y: 0 });
  });

  it("empty input returns no segments", () => {
    expect(catmullRomToCubic([], false)).toEqual([]);
  });
});

describe("vectorizeStroke", () => {
  it("produces fewer Béziers than raw points on a smooth path", () => {
    const raw: PctPoint[] = Array.from({ length: 60 }, (_, i) => ({
      x: i * 0.4,
      y: Math.sin(i / 6) * 2,
    }));
    const v = vectorizeStroke(raw, { closed: false });
    expect(v.closed).toBe(false);
    expect(v.segments.length).toBeGreaterThan(0);
    expect(v.segments.length).toBeLessThan(raw.length);
  });

  it("honours the closed flag", () => {
    const ring: PctPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(vectorizeStroke(ring, { closed: true }).closed).toBe(true);
  });
});

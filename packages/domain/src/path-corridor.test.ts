import { describe, expect, it } from "vitest";
import {
  makePathCorridor,
  pathCorridorRingPct,
  pathFilletCues,
} from "./path-corridor";

describe("path-corridor", () => {
  it("buffers a straight centreline into a closed ring", () => {
    const ring = pathCorridorRingPct(
      [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
      1.2,
      100,
    );
    expect(ring.length).toBeGreaterThanOrEqual(4);
    // Half-width 0.6 m on 100 m board → 0.6% each side
    const ys = ring.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(50);
    expect(Math.max(...ys)).toBeGreaterThan(50);
  });

  it("builds a corridor with craft why-copy", () => {
    const c = makePathCorridor({
      points: [
        { x: 20, y: 20 },
        { x: 40, y: 40 },
        { x: 60, y: 20 },
      ],
      material: "paving",
      pathWidthM: 1.2,
      edgeType: "soldier",
      pathFilletM: 0.6,
    });
    expect(c).not.toBeNull();
    expect(c!.why).toMatch(/Soldier/);
    expect(c!.why).toMatch(/R0\.6/);
  });

  it("emits fillet cues at interior vertices only", () => {
    const cues = pathFilletCues(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ],
      0.6,
      100,
    );
    expect(cues).toHaveLength(1);
    expect(cues[0]!.x).toBe(50);
    expect(cues[0]!.rPct).toBeCloseTo(0.6, 5);
  });
});

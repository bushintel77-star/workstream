import { describe, expect, it } from "vitest";
import {
  buildDrainageFallCues,
  makeIndicativeDrainageRun,
  sortRunDownhill,
} from "./drainage-runs";

describe("drainage-runs", () => {
  it("orders points from high RL to low", () => {
    const sorted = sortRunDownhill([
      { x: 10, y: 10, z: 12.1 },
      { x: 20, y: 20, z: 12.4 },
      { x: 30, y: 30, z: 12.0 },
    ]);
    expect(sorted.map((p) => p.z)).toEqual([12.4, 12.1, 12.0]);
  });

  it("builds fall cues along an indicative run", () => {
    const run = makeIndicativeDrainageRun([
      { x: 0, y: 0, z: 13 },
      { x: 50, y: 0, z: 12 },
    ]);
    expect(run).not.toBeNull();
    const cues = buildDrainageFallCues(run!, 100);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.fallPct).toBeGreaterThan(0);
    expect(cues[0]!.adverse).toBe(false);
  });
});

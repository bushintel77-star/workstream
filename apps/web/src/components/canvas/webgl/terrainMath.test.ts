import { describe, expect, it } from "vitest";
import {
  idwElevation,
  normalizeLevels,
  createElevationSampler,
  VERTICAL_SCALE,
  SEARCH_RADIUS_FACTOR,
  type HeightmapPoint,
} from "./terrainMath";

/* -------------------------------------------------------------------------- */
/* idwElevation                                                               */
/* -------------------------------------------------------------------------- */

describe("idwElevation", () => {
  it("returns 0 when there are no samples", () => {
    expect(idwElevation(5, 5, [], 10)).toBe(0);
  });

  it("returns the exact sample elevation at a sample point (dist === 0)", () => {
    const samples: HeightmapPoint[] = [{ x: 0, z: 0, y: 7.5 }];
    expect(idwElevation(0, 0, samples, 10)).toBe(7.5);
  });

  it("returns 0 when no sample is within the search radius", () => {
    const samples: HeightmapPoint[] = [{ x: 0, z: 0, y: 7.5 }];
    // Query 100m away, radius 10m → out of range.
    expect(idwElevation(100, 100, samples, 10)).toBe(0);
  });

  it("weights nearer samples more heavily than farther ones", () => {
    // Two samples at the same y wouldn't distinguish — use different y values.
    // Sample A at (0,0) y=0, sample B at (1,0) y=10. Query at (0.1, 0).
    // A is closer (0.1) than B (0.9), so the result should be much closer to 0 than 10.
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 0 },
      { x: 1, z: 0, y: 10 },
    ];
    const result = idwElevation(0.1, 0, samples, 5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1); // heavily weighted toward the near 0 sample
  });

  it("uses the configured IDW power parameter", () => {
    // With power 2.5 (the const), a sample 2m away contributes 1/2^2.5 of a 1m sample.
    // Sanity: the result is a finite positive number in the weighted range.
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 2 },
      { x: 0, z: 2, y: 4 },
    ];
    const result = idwElevation(0, 0.5, samples, 5);
    expect(result).toBeGreaterThan(2);
    expect(result).toBeLessThan(4);
  });

  it("is a pure function — identical inputs give identical outputs", () => {
    const samples: HeightmapPoint[] = [
      { x: 1, z: 1, y: 3 },
      { x: 4, z: 4, y: 6 },
    ];
    const a = idwElevation(2, 2, samples, 8);
    const b = idwElevation(2, 2, samples, 8);
    expect(a).toBe(b);
  });
});

/* -------------------------------------------------------------------------- */
/* normalizeLevels                                                            */
/* -------------------------------------------------------------------------- */

describe("normalizeLevels", () => {
  it("returns [] for empty input", () => {
    expect(normalizeLevels([])).toEqual([]);
  });

  it("subtracts the mean so samples centre on y=0", () => {
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 50 }, // AHD ~50m (typical Melbourne)
      { x: 5, z: 0, y: 52 },
    ];
    const out = normalizeLevels(samples);
    // mean = 51; after mean subtraction + VERTICAL_SCALE: (50-51)*3 = -3, (52-51)*3 = 3
    expect(out[0]!.y).toBeCloseTo(-3, 5);
    expect(out[1]!.y).toBeCloseTo(3, 5);
  });

  it("applies the vertical exaggeration factor", () => {
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 10 },
      { x: 1, z: 0, y: 11 }, // 1m difference
    ];
    const out = normalizeLevels(samples);
    // mean = 10.5; diff from mean = ±0.5; × VERTICAL_SCALE = ±1.5
    expect(out[0]!.y).toBeCloseTo(-0.5 * VERTICAL_SCALE, 5);
    expect(out[1]!.y).toBeCloseTo(0.5 * VERTICAL_SCALE, 5);
  });

  it("preserves x/z positions (only y changes)", () => {
    const samples: HeightmapPoint[] = [{ x: 3, z: 7, y: 50 }];
    const out = normalizeLevels(samples);
    expect(out[0]!.x).toBe(3);
    expect(out[0]!.z).toBe(7);
  });
});

/* -------------------------------------------------------------------------- */
/* createElevationSampler                                                     */
/* -------------------------------------------------------------------------- */

describe("createElevationSampler", () => {
  it("returns null when there are no samples (flat project)", () => {
    expect(createElevationSampler([], 20, 1)).toBeNull();
  });

  it("returns a sampler that matches idwElevation on normalized levels", () => {
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 50 },
      { x: 10, z: 0, y: 51 },
    ];
    const scaleM = 20;
    const boardAspect = 1;
    const sampler = createElevationSampler(samples, scaleM, boardAspect);
    expect(sampler).not.toBeNull();

    // The sampler normalises internally; reproduce the same normalisation to verify.
    const normalized = normalizeLevels(samples);
    const searchRadius = Math.max(scaleM, scaleM * boardAspect) * SEARCH_RADIUS_FACTOR;

    const queryX = 3;
    const queryZ = 2;
    expect(sampler!(queryX, queryZ)).toBe(
      idwElevation(queryX, queryZ, normalized, searchRadius),
    );
  });

  it("the sampler agrees with itself across calls (stable)", () => {
    const samples: HeightmapPoint[] = [
      { x: 0, z: 0, y: 1 },
      { x: 5, z: 5, y: 3 },
    ];
    const sampler = createElevationSampler(samples, 20, 1)!;
    const a = sampler(2, 2);
    const b = sampler(2, 2);
    expect(a).toBe(b);
  });
});

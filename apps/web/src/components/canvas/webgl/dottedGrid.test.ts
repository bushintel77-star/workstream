import { describe, expect, it } from "vitest";
import {
  GRID_BLEND_BAND,
  GRID_SPACINGS,
  GRID_TIER_THRESHOLDS,
  gridFocal,
  gridTierFor,
  setGridFocal,
} from "./dottedGrid";

describe("gridTierFor", () => {
  const lo = GRID_TIER_THRESHOLDS[0];
  const hi = GRID_TIER_THRESHOLDS[1];
  const band = GRID_BLEND_BAND;

  it("uses the tight 2.5 m spacing close up", () => {
    const t = gridTierFor(lo * 0.5);
    expect(t.spacingA).toBe(GRID_SPACINGS[0]);
    expect(t.blend).toBe(0);
  });

  it("uses the mid 10 m spacing in the working range", () => {
    const t = gridTierFor((lo + hi) / 2);
    expect(t.spacingA).toBe(GRID_SPACINGS[1]);
    expect(t.blend).toBe(0);
  });

  it("uses the wide 40 m spacing at full-site overview", () => {
    const t = gridTierFor(hi * 1.5);
    expect(t.spacingA).toBe(GRID_SPACINGS[2]);
    expect(t.blend).toBe(0);
  });

  it("blends 2.5 m into 10 m across the first threshold band", () => {
    const start = lo * (1 - band);
    const end = lo * (1 + band);
    const mid = gridTierFor((start + end) / 2);
    expect(mid.spacingA).toBe(GRID_SPACINGS[0]);
    expect(mid.spacingB).toBe(GRID_SPACINGS[1]);
    expect(mid.blend).toBeCloseTo(0.5, 6);
    expect(gridTierFor(start).blend).toBe(0);
    expect(gridTierFor(end).blend).toBe(0);
    expect(gridTierFor(end).spacingA).toBe(GRID_SPACINGS[1]);
  });

  it("blends 10 m into 40 m across the second threshold band", () => {
    const start = hi * (1 - band);
    const end = hi * (1 + band);
    const mid = gridTierFor((start + end) / 2);
    expect(mid.spacingA).toBe(GRID_SPACINGS[1]);
    expect(mid.spacingB).toBe(GRID_SPACINGS[2]);
    expect(mid.blend).toBeCloseTo(0.5, 6);
    expect(gridTierFor(end).spacingA).toBe(GRID_SPACINGS[2]);
  });
});

describe("gridFocal", () => {
  it("tracks the last interaction point without React state", () => {
    expect(gridFocal.touched).toBe(false);
    setGridFocal(3.5, -2.25);
    expect(gridFocal.x).toBe(3.5);
    expect(gridFocal.z).toBe(-2.25);
    expect(gridFocal.touched).toBe(true);
    setGridFocal(0, 0);
    expect(gridFocal.touched).toBe(true);
  });
});

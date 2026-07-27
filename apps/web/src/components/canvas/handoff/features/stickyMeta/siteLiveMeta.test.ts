import { describe, expect, it } from "vitest";
import { buildSiteLiveMeta } from "./siteLiveMeta";

const SQUARE = [
  { x: 20, y: 20 },
  { x: 60, y: 20 },
  { x: 60, y: 60 },
  { x: 20, y: 60 },
];

describe("buildSiteLiveMeta", () => {
  it("estimates lot area from the board-% boundary at scale", () => {
    const meta = buildSiteLiveMeta({
      boundary: SQUARE,
      building: [],
      easements: [],
      scaleM: 100,
      lotAreaM2: null,
    });
    // 40% × 40% of a 100 m board = 40 m × 40 m = 1600 m²
    expect(meta.lotAreaM2).toBeCloseTo(1600, 0);
    expect(meta.areaSurveyed).toBe(false);
    expect(meta.face).toMatch(/1600\.00 m² · boundary/);
    expect(meta.detail).toMatch(/No dwelling · no easements/);
  });

  it("prefers a surveyed lot area and title source on the face", () => {
    const meta = buildSiteLiveMeta({
      boundary: SQUARE,
      building: SQUARE,
      easements: [SQUARE],
      scaleM: 100,
      lotAreaM2: 412,
      titleSource: "Vicmap",
    });
    expect(meta.areaSurveyed).toBe(true);
    expect(meta.face).toBe("412.00 m² · Vicmap");
    expect(meta.hasDwelling).toBe(true);
    expect(meta.easementCount).toBe(1);
    expect(meta.detail).toBe("Dwelling · 1 easement");
  });

  it("falls back to the Site · boundary face with no boundary traced", () => {
    const meta = buildSiteLiveMeta({
      boundary: [],
      building: [],
      easements: [],
      scaleM: 100,
      lotAreaM2: null,
    });
    expect(meta.lotAreaM2).toBe(0);
    expect(meta.face).toBe("Site · boundary");
  });
});

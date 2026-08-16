import { describe, expect, it } from "vitest";
import {
  createElevationSampler,
  drapeRingToSurface,
  normalizeLevels,
} from "./terrainMath";

/**
 * The measured bug this pins: semantic lines drawn at constant world-Z
 * intersected the IDW terrain — on the Wrights Terrace seed the title
 * boundary sat up to 7.63 m BELOW the surface on high ground and floated
 * 7.33 m above it on low ground. Draping via the shared sampler must put
 * every line point ON the surface by construction.
 */

const LEVELS = [
  { x: -39.6, z: -25.0, y: 30.4 },
  { x: 30.8, z: -25.0, y: 30.9 },
  { x: 28.6, z: 20.5, y: 29.6 },
  { x: -36.3, z: 20.5, y: 29.2 },
];

const BOUNDARY_PCT = [
  { x: 8, y: 12 },
  { x: 88, y: 10 },
  { x: 92, y: 62 },
  { x: 70, y: 88 },
  { x: 14, y: 86 },
];

describe("drapeRingToSurface", () => {
  const sampler = createElevationSampler(LEVELS, 110, 0.775);
  expect(sampler).not.toBeNull();
  const s = sampler!;

  it("places every point at terrain height + clearance (never under, never floating)", () => {
    const pts = drapeRingToSurface(BOUNDARY_PCT, {
      sampler: s,
      scaleM: 110,
      boardAspect: 0.775,
      offsetM: 0.06,
    });
    expect(pts.length).toBeGreaterThan(BOUNDARY_PCT.length);
    for (const [wx, y, wz] of pts) {
      const surface = s(wx, wz);
      // Exactly the clearance above the surface — not intersecting it.
      expect(y - surface).toBeCloseTo(0.06, 5);
    }
  });

  it("follows relief between vertices (subdivision), not chords", () => {
    const pts = drapeRingToSurface(BOUNDARY_PCT, {
      sampler: s,
      scaleM: 110,
      boardAspect: 0.775,
      offsetM: 0.06,
      segmentM: 4,
    });
    const ys = pts.map((p) => p[1]);
    const spread = Math.max(...ys) - Math.min(...ys);
    // The seeded relief spans metres — a chorded/flat line would have ~0.
    expect(spread).toBeGreaterThan(1);
    // Consecutive points are ≤ ~4 m of edge apart.
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(
        pts[i][0] - pts[i - 1][0],
        pts[i][2] - pts[i - 1][2],
      );
      expect(d).toBeLessThanOrEqual(4.5);
    }
  });

  it("falls back to flat at the offset when no terrain exists", () => {
    const pts = drapeRingToSurface(BOUNDARY_PCT, {
      sampler: null,
      scaleM: 110,
      boardAspect: 0.775,
      offsetM: 0.06,
    });
    for (const p of pts) expect(p[1]).toBeCloseTo(0.06, 5);
  });

  it("uses the shared datum (normalizeLevels) — sampler matches mesh displacement", () => {
    const normalized = normalizeLevels(LEVELS);
    // At an exact sample point the sampler returns that point's normalized y.
    expect(s(LEVELS[0].x, LEVELS[0].z)).toBeCloseTo(normalized[0].y, 5);
  });
});

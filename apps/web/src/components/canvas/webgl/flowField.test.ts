import { describe, expect, it } from "vitest";
import {
  buildFlowGrid,
  buildStudioFlowGrid,
  traceStreamNetwork,
  findPondingPoints,
  STREAM_MIN_ACCUM_FRACTION,
  type FlowGrid,
} from "./flowField";
import { GRID_SEGMENTS } from "./terrainMath";

/* -------------------------------------------------------------------------- */
/* Helpers — synthetic analytic surfaces                                      */
/* -------------------------------------------------------------------------- */

/** Uniform 10% fall toward +x, dead flat in z (real-metre gradient 0.1). */
const planeSlope = (x: number, _z: number): number => -0.1 * x;

/** V-valley with a slight longitudinal fall — converges to the z≈0 axis. */
const valley = (x: number, z: number): number => Math.abs(z) - 0.05 * x;

/** Paraboloid bowl centred on the origin — everything drains to the middle. */
const bowl = (x: number, z: number): number => x * x + z * z;

/** Small grid: 11×11 nodes over a 100×100 world rectangle. */
function smallGrid(
  sampler: (x: number, z: number) => number,
): FlowGrid {
  return buildFlowGrid(sampler, 100, 100, 10);
}

/* -------------------------------------------------------------------------- */
/* buildFlowGrid                                                              */
/* -------------------------------------------------------------------------- */

describe("buildFlowGrid", () => {
  it("sizes the grid to segments + 1 with world-centred extents", () => {
    const grid = buildFlowGrid(planeSlope, 100, 60, 10);
    expect(grid.cols).toBe(11);
    expect(grid.rows).toBe(11);
    expect(grid.x0).toBeCloseTo(-50, 5);
    expect(grid.z0).toBeCloseTo(-30, 5);
    expect(grid.dx).toBeCloseTo(10, 5);
    expect(grid.dz).toBeCloseTo(6, 5);
  });

  it("every cell starts with unit accumulation", () => {
    const grid = smallGrid(planeSlope);
    for (const a of grid.accumulation) expect(a).toBeGreaterThanOrEqual(1);
  });

  it("reports the steepest single-node slope as a real-basis percentage", () => {
    // Gradient 0.1 → 10% along x; diagonals are shallower on this surface.
    const grid = smallGrid(planeSlope);
    expect(grid.maxSlopePct).toBeCloseTo(10, 5);
  });

  it("is deterministic — identical builds produce identical fields", () => {
    const a = smallGrid(valley);
    const b = smallGrid(valley);
    expect(Array.from(a.elev)).toEqual(Array.from(b.elev));
    expect(Array.from(a.downhill)).toEqual(Array.from(b.downhill));
    expect(Array.from(a.accumulation)).toEqual(Array.from(b.accumulation));
  });

  it("flat surface has no downhill links, no slope, unit accumulation", () => {
    const grid = smallGrid(() => 0);
    expect(grid.maxSlopePct).toBe(0);
    for (let i = 0; i < grid.downhill.length; i++) {
      expect(grid.downhill[i]).toBe(-1);
      expect(grid.accumulation[i]).toBe(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* traceStreamNetwork                                                         */
/* -------------------------------------------------------------------------- */

describe("traceStreamNetwork", () => {
  it("plane slope: one stream per row, all flowing toward +x", () => {
    const grid = smallGrid(planeSlope);
    const paths = traceStreamNetwork(grid, 0.02);
    // 11 independent rows (no cross-row convergence on a plane tilted in x).
    expect(paths.length).toBe(11);
    for (const p of paths) {
      expect(p.points.length).toBeGreaterThanOrEqual(2);
      // Downhill in x: every hop increases x by the node spacing.
      for (let i = 1; i < p.points.length; i++) {
        expect(p.points[i]![0]).toBeGreaterThan(p.points[i - 1]![0]);
      }
    }
  });

  it("V-valley: the main channel tracks the valley floor", () => {
    const grid = smallGrid(valley);
    const paths = traceStreamNetwork(grid, 0.02);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    // Tributaries run straight down the walls to the floor; the dominant
    // path (peak accumulation) should finish along the z ≈ 0 axis.
    const main = paths.reduce((a, b) => (b.maxAccum > a.maxAccum ? b : a));
    const tail = main.points.slice(-5);
    for (const pt of tail) {
      expect(Math.abs(pt[2])).toBeLessThanOrEqual(grid.dz + 1e-6);
    }
  });

  it("bowl: paths terminate at the central pit", () => {
    const grid = smallGrid(bowl);
    const paths = traceStreamNetwork(grid, 0.02);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    // The grid centre node is (5,5) → world (0, 0).
    const endsAtCentre = paths.some(
      (p) =>
        Math.abs(p.points[p.points.length - 1]![0]) < 1e-6 &&
        Math.abs(p.points[p.points.length - 1]![2]) < 1e-6,
    );
    expect(endsAtCentre).toBe(true);
  });

  it("flat surface traces no streams", () => {
    const grid = smallGrid(() => 0);
    expect(traceStreamNetwork(grid, STREAM_MIN_ACCUM_FRACTION)).toEqual([]);
  });

  it("higher thresholds prune headwaters (fewer, shorter paths)", () => {
    const grid = smallGrid(bowl);
    const loose = traceStreamNetwork(grid, 0.01);
    const tight = traceStreamNetwork(grid, 0.2);
    expect(tight.length).toBeLessThanOrEqual(loose.length);
  });
});

/* -------------------------------------------------------------------------- */
/* findPondingPoints                                                          */
/* -------------------------------------------------------------------------- */

describe("findPondingPoints", () => {
  it("bowl: exactly one pond at the centre carrying the whole grid", () => {
    const grid = smallGrid(bowl);
    const ponds = findPondingPoints(grid, 0.02, 0.01);
    expect(ponds.length).toBe(1);
    const pond = ponds[0]!;
    expect(pond.x).toBeCloseTo(0, 5);
    expect(pond.z).toBeCloseTo(0, 5);
    // 11×11 nodes × (10m × 10m) cells = 12,100 m² catchment.
    expect(pond.catchmentM2).toBeCloseTo(121 * 100, -2);
    expect(pond.depthM).toBeGreaterThan(0.01);
  });

  it("plane slope: no ponds (boundary pits are outlets, not ponds)", () => {
    const grid = smallGrid(planeSlope);
    expect(findPondingPoints(grid, 0.02, 0.01)).toEqual([]);
  });

  it("flat surface: no ponds (zero relief fails the min-depth test)", () => {
    const grid = smallGrid(() => 0);
    expect(findPondingPoints(grid, 0.0, 0.01)).toEqual([]);
  });

  it("twin bowls: two ponds, sorted by catchment, covering the whole grid", () => {
    // Bowls centred ON grid nodes (dx = 10, centres at x = ±20) so each has
    // exactly one pit. The ridge column (x = 0) drains west, so the west
    // catchment is larger — but together they receive every cell.
    const twinBowls = (x: number, z: number): number => {
      const a = (x + 20) * (x + 20) + z * z;
      const b = (x - 20) * (x - 20) + z * z;
      return Math.min(a, b);
    };
    const grid = buildFlowGrid(twinBowls, 200, 100, 20);
    const ponds = findPondingPoints(grid, 0.02, 0.01);
    expect(ponds.length).toBe(2);
    expect(ponds[0]!.catchmentM2).toBeGreaterThanOrEqual(ponds[1]!.catchmentM2);
    // 21×21 nodes × (10m × 5m) cells — every cell drains to one of the pits.
    const totalArea = 21 * 21 * (grid.dx * grid.dz);
    expect(ponds[0]!.catchmentM2 + ponds[1]!.catchmentM2).toBeCloseTo(
      totalArea,
      -2,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* buildStudioFlowGrid                                                        */
/* -------------------------------------------------------------------------- */

describe("buildStudioFlowGrid", () => {
  it("applies the TerrainMesh extents + resolution (w = scaleM × 3)", () => {
    const grid = buildStudioFlowGrid(planeSlope, 40, 2);
    expect(grid.cols).toBe(GRID_SEGMENTS + 1);
    expect(grid.rows).toBe(GRID_SEGMENTS + 1);
    expect(grid.x0).toBeCloseTo(-60, 5); // 40 × 3 / 2
    expect(grid.z0).toBeCloseTo(-120, 5); // 40 × 2 × 3 / 2
  });
});

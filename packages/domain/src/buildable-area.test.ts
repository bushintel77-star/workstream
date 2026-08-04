import { describe, expect, it } from "vitest";
import { computeBuildableArea } from "./buildable-area";
import type { BoardPctPoint } from "./buildable-area";

const BOARD_WIDTH_M = 40; // 100% = 40 m

/** Square lot: 0,0 → 100,0 → 100,100 → 0,100 (40 m × 40 m = 1600 m²). */
const SQUARE_LOT: BoardPctPoint[] = [
  { x_pct: 0, y_pct: 0 },
  { x_pct: 100, y_pct: 0 },
  { x_pct: 100, y_pct: 100 },
  { x_pct: 0, y_pct: 100 },
];

describe("computeBuildableArea", () => {
  it("returns full lot when no exclusions", () => {
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    expect(result.lot_m2).toBeCloseTo(1600, 0);
    expect(result.buildable_m2).toBeCloseTo(1600, 0);
    expect(result.exclusions).toHaveLength(0);
    expect(result.polygons.length).toBeGreaterThanOrEqual(1);
  });

  it("subtracts building footprint and attributes the area", () => {
    const building: BoardPctPoint[] = [
      { x_pct: 30, y_pct: 30 },
      { x_pct: 70, y_pct: 30 },
      { x_pct: 70, y_pct: 70 },
      { x_pct: 30, y_pct: 70 },
    ];
    // Building = 40% × 40% of 40 m = 16 m × 16 m = 256 m²
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      building,
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    expect(result.lot_m2).toBeCloseTo(1600, 0);
    const buildingExcl = result.exclusions.find((e) => e.kind === "building");
    expect(buildingExcl).toBeDefined();
    expect(buildingExcl!.area_m2).toBeCloseTo(256, 0);
    expect(result.buildable_m2).toBeCloseTo(1344, 0);
  });

  it("subtracts easement strip and attributes the area", () => {
    const easement: BoardPctPoint[] = [
      { x_pct: 0, y_pct: 0 },
      { x_pct: 10, y_pct: 0 },
      { x_pct: 10, y_pct: 100 },
      { x_pct: 0, y_pct: 100 },
    ];
    // Easement = 10% of 40 m × 40 m = 4 m × 40 m = 160 m²
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      easements: [easement],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    const easementExcl = result.exclusions.find((e) => e.kind === "easement");
    expect(easementExcl).toBeDefined();
    expect(easementExcl!.area_m2).toBeCloseTo(160, 0);
    expect(result.buildable_m2).toBeCloseTo(1440, 0);
  });

  it("subtracts TPZ circle and attributes the area", () => {
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      tpz_circles: [
        { id: "t1", x_pct: 50, y_pct: 50, radius_m: 5 },
      ],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    const tpzExcl = result.exclusions.find((e) => e.kind === "tpz");
    expect(tpzExcl).toBeDefined();
    // π × 5² ≈ 78.5 m² (full circle inside the lot)
    // π × 5² ≈ 78.5 m² — allow rounding to 1 decimal place
    expect(tpzExcl!.area_m2).toBeGreaterThanOrEqual(78);
    expect(tpzExcl!.area_m2).toBeLessThanOrEqual(79);
  });

  it("subtracts setback and attributes the area", () => {
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      setback_m: 2,
      board_width_m: BOARD_WIDTH_M,
    });
    const setbackExcl = result.exclusions.find((e) => e.kind === "setback");
    expect(setbackExcl).toBeDefined();
    // 40×40 lot minus 36×36 inset = 1600 − 1296 = 304 m²
    expect(setbackExcl!.area_m2).toBeCloseTo(304, 0);
    expect(result.buildable_m2).toBeCloseTo(1296, 0);
  });

  it("TPZ overlapping building attributes only the non-building portion", () => {
    const building: BoardPctPoint[] = [
      { x_pct: 30, y_pct: 30 },
      { x_pct: 70, y_pct: 30 },
      { x_pct: 70, y_pct: 70 },
      { x_pct: 30, y_pct: 70 },
    ];
    // TPZ centered on the building — overlap should go to building (processed first)
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      building,
      tpz_circles: [
        { id: "t1", x_pct: 50, y_pct: 50, radius_m: 3 },
      ],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    const buildingExcl = result.exclusions.find((e) => e.kind === "building");
    const tpzExcl = result.exclusions.find((e) => e.kind === "tpz");
    expect(buildingExcl).toBeDefined();
    // Building gets full 256 m². The TPZ circle (r=3 at 20m,20m) is entirely
    // inside the building (12-28m), so after the building is subtracted there
    // is nothing left for the TPZ to remove — no TPZ exclusion is recorded.
    expect(buildingExcl!.area_m2).toBeCloseTo(256, 0);
    // TPZ entirely inside building — no attribution (area already gone).
    expect(tpzExcl).toBeUndefined();
  });

  it("subtracts BYDA asset and attributes with kind label", () => {
    const sewer: BoardPctPoint[] = [
      { x_pct: 40, y_pct: 0 },
      { x_pct: 50, y_pct: 0 },
      { x_pct: 50, y_pct: 100 },
      { x_pct: 40, y_pct: 100 },
    ];
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      byda_assets: [{ kind: "sewer", ring: sewer }],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    const bydaExcl = result.exclusions.find((e) => e.kind === "byda");
    expect(bydaExcl).toBeDefined();
    expect(bydaExcl!.label).toBe("Sewer BYDA asset");
    // 10% × 100% = 4 m × 40 m = 160 m²
    expect(bydaExcl!.area_m2).toBeCloseTo(160, 0);
  });

  it("subtracts flood overlay", () => {
    const flood: BoardPctPoint[] = [
      { x_pct: 0, y_pct: 0 },
      { x_pct: 100, y_pct: 0 },
      { x_pct: 100, y_pct: 20 },
      { x_pct: 0, y_pct: 20 },
    ];
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      overlays: [{ kind: "flood", rings: [flood] }],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    const floodExcl = result.exclusions.find((e) => e.kind === "flood");
    expect(floodExcl).toBeDefined();
    // 100% × 20% = 40 m × 8 m = 320 m²
    expect(floodExcl!.area_m2).toBeCloseTo(320, 0);
  });

  it("returns empty for degenerate boundary", () => {
    const result = computeBuildableArea({
      boundary: [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }],
      setback_m: 0,
      board_width_m: BOARD_WIDTH_M,
    });
    expect(result.lot_m2).toBe(0);
    expect(result.buildable_m2).toBe(0);
    expect(result.polygons).toHaveLength(0);
  });

  it("combines multiple exclusions and sums correctly", () => {
    const building: BoardPctPoint[] = [
      { x_pct: 30, y_pct: 30 },
      { x_pct: 70, y_pct: 30 },
      { x_pct: 70, y_pct: 70 },
      { x_pct: 30, y_pct: 70 },
    ];
    const easement: BoardPctPoint[] = [
      { x_pct: 0, y_pct: 0 },
      { x_pct: 10, y_pct: 0 },
      { x_pct: 10, y_pct: 100 },
      { x_pct: 0, y_pct: 100 },
    ];
    const result = computeBuildableArea({
      boundary: SQUARE_LOT,
      building,
      easements: [easement],
      setback_m: 1.5,
      board_width_m: BOARD_WIDTH_M,
    });
    // Lot 1600. Setback 1.5 m → inset 37×37 = 1369, lost ~231 m².
    // Building 16×16 = 256 m² (entirely inside inset).
    // Easement 4 m strip, but only 2.5 m of it is inside the inset (1.5–4 m),
    // so easement loses ~92.5 m² (2.5 × 37), not the full 160.
    // Buildable ≈ 1600 − 231 − 256 − 92.5 ≈ 1020.
    expect(result.buildable_m2).toBeLessThan(1100);
    expect(result.buildable_m2).toBeGreaterThan(900);
    expect(result.exclusions.length).toBeGreaterThanOrEqual(3);
  });
});

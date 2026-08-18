import { describe, expect, it } from "vitest";
import {
  CLAMPED_PLACEMENT_FIELDS,
  DIRECT_PLACEMENT_FIELDS,
  clampPlacementEdit,
  patchClamps,
  placementEditClamps,
} from "./inspectorPolicy";

const SQUARE = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

const basePlacement = {
  id: "c39b0a2c-2222-4333-8444-000000000001",
  symbol_id: "bluestone-paver",
  x_pct: 50,
  y_pct: 50,
  rotation_deg: 0,
  scale: 1,
};

describe("inspector field classification (locked)", () => {
  it("clamps exactly scale and canopy_radius_m", () => {
    expect([...CLAMPED_PLACEMENT_FIELDS].sort()).toEqual([
      "canopy_radius_m",
      "scale",
    ]);
    expect(placementEditClamps("scale")).toBe(true);
    expect(placementEditClamps("canopy_radius_m")).toBe(true);
    // The ambiguous one, locked on sign-off: height changes mass, not
    // footprint — direct persist, no clamp.
    expect(placementEditClamps("height_m")).toBe(false);
    expect(DIRECT_PLACEMENT_FIELDS.has("height_m")).toBe(true);
    for (const f of ["symbol_id", "rotation_deg", "label"] as const) {
      expect(placementEditClamps(f)).toBe(false);
    }
  });

  it("patchClamps detects a clamped field inside any patch", () => {
    expect(patchClamps({ scale: 2 })).toBe(true);
    expect(patchClamps({ canopy_radius_m: 3 })).toBe(true);
    expect(patchClamps({ label: "x" })).toBe(false);
    expect(patchClamps({ height_m: 2.4 })).toBe(false);
  });
});

describe("clampPlacementEdit", () => {
  it("passes through when the site has no boundary ring", () => {
    const r = clampPlacementEdit({ ...basePlacement, x_pct: 2 }, [], []);
    expect(r).toEqual({ x: 2, y: 50, snapped: false, reason: null });
  });

  it("leaves an in-bounds centre untouched", () => {
    const r = clampPlacementEdit(basePlacement, SQUARE, []);
    expect(r.snapped).toBe(false);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
  });

  it("pulls an out-of-bounds centre onto the boundary", () => {
    const r = clampPlacementEdit({ ...basePlacement, x_pct: 2 }, SQUARE, []);
    expect(r.snapped).toBe(true);
    expect(r.x).toBeGreaterThan(2);
    expect(r.reason).toBeTruthy();
  });
});

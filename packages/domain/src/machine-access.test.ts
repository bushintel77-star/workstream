import { describe, it, expect } from "vitest";
import {
  computeMachineAccess,
  machineAccessBandLabel,
  machineAccessLabourMultiplier,
} from "./machine-access";
import {
  DEFAULT_PLANT_MACHINES,
  type OperatorPlantProfile,
} from "@workstream/contracts";

const PROFILE: OperatorPlantProfile = {
  owner_id: "test",
  machines: DEFAULT_PLANT_MACHINES,
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SCALE_M = 20; // 20 m board width — 1% = 0.2 m

// Helper: a rectangular boundary in board %.
function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

describe("computeMachineAccess", () => {
  it("returns null when there is no building", () => {
    const boundary = rect(10, 10, 90, 90);
    const result = computeMachineAccess(boundary, [], SCALE_M, PROFILE);
    expect(result).toBeNull();
  });

  it("returns null when the building has fewer than 3 points", () => {
    const boundary = rect(10, 10, 90, 90);
    const building = [
      { x: 40, y: 40 },
      { x: 60, y: 40 },
    ];
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).toBeNull();
  });

  it("classifies a wide-open site as standard bobcat access", () => {
    // Boundary 10–90%, building 40–60% — 30% gap each side = 6 m.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(40, 40, 60, 60);
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    expect(result!.band).toBe("standard");
    expect(result!.widthM).toBeGreaterThan(5);
    expect(result!.machineName).toBe("Standard bobcat");
  });

  it("classifies a pinched one-side site as barrow only", () => {
    // Building pushed to the west edge — 2% gap = 0.4 m on the west side.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(12, 30, 50, 70);
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    // The widest corridor is the east side (40% = 8 m) — standard.
    // But the west corridor is 0.4 m — barrow. The primary is the widest.
    expect(result!.corridors.length).toBeGreaterThanOrEqual(2);
    const west = result!.corridors.find((c) => c.side === "west");
    expect(west).toBeDefined();
    expect(west!.widthM).toBeLessThan(0.5);
  });

  it("returns width 0 and band 'none' when the building touches the boundary", () => {
    // Building shares the west boundary edge.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(10, 30, 50, 70);
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    const west = result!.corridors.find((c) => c.side === "west");
    expect(west).toBeDefined();
    expect(west!.widthM).toBe(0);
  });

  it("reports both side corridors", () => {
    const boundary = rect(10, 10, 90, 90);
    const building = rect(35, 30, 55, 70);
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    expect(result!.corridors.length).toBeGreaterThanOrEqual(2);
    // Corridors sorted widest first.
    expect(result!.corridors[0]!.widthM).toBeGreaterThanOrEqual(
      result!.corridors[1]!.widthM,
    );
  });

  it("uses the operator's plant profile for band thresholds", () => {
    // Custom profile: only a barrow (0 mm) and a wide machine (2000 mm).
    const customProfile: OperatorPlantProfile = {
      owner_id: "custom",
      machines: [
        { id: "barrow", name: "Wheelbarrow", min_access_width_mm: 0 },
        { id: "wide-loader", name: "Wide loader", min_access_width_mm: 2000 },
      ],
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    // 30% gap = 6 m = 6000 mm — fits the wide loader.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(40, 40, 60, 60);
    const result = computeMachineAccess(boundary, building, SCALE_M, customProfile);
    expect(result).not.toBeNull();
    expect(result!.band).toBe("standard");
    expect(result!.machineName).toBe("Wide loader");
  });

  it("falls back to barrow when the profile is null", () => {
    // 30% gap = 6 m, but no profile → no machine fits the standard/narrow checks.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(40, 40, 60, 60);
    const result = computeMachineAccess(boundary, building, SCALE_M, null);
    expect(result).not.toBeNull();
    expect(result!.band).toBe("barrow");
    expect(result!.machineName).toBeNull();
  });

  it("excludes the street frontage from the corridor search", () => {
    // Boundary with street at the south (bottom). Building close to the south
    // edge but far from the sides — the south gap should NOT be reported as a
    // corridor because it is the frontage, not a side access.
    const boundary = rect(10, 10, 90, 90);
    const building = rect(35, 70, 65, 85); // near the south edge
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    // The primary corridor should be a side (east or west), not south.
    expect(result!.sideLabel).not.toBe("south");
  });

  it("returns a pinch point in board % coords", () => {
    const boundary = rect(10, 10, 90, 90);
    const building = rect(40, 40, 60, 60);
    const result = computeMachineAccess(boundary, building, SCALE_M, PROFILE);
    expect(result).not.toBeNull();
    expect(result!.pinchPoint.x).toBeGreaterThanOrEqual(0);
    expect(result!.pinchPoint.x).toBeLessThanOrEqual(100);
    expect(result!.pinchPoint.y).toBeGreaterThanOrEqual(0);
    expect(result!.pinchPoint.y).toBeLessThanOrEqual(100);
  });
});

describe("machineAccessBandLabel", () => {
  it("labels each band", () => {
    expect(machineAccessBandLabel("barrow")).toBe("barrow only");
    expect(machineAccessBandLabel("narrow")).toBe("narrow-access machine");
    expect(machineAccessBandLabel("standard")).toBe("standard bobcat access");
    expect(machineAccessBandLabel("none")).toBe("no side access");
  });
});

describe("machineAccessLabourMultiplier", () => {
  it("applies the full penalty for barrow/none", () => {
    expect(machineAccessLabourMultiplier("barrow")).toBe(1.15);
    expect(machineAccessLabourMultiplier("none")).toBe(1.15);
  });
  it("applies a reduced penalty for narrow", () => {
    expect(machineAccessLabourMultiplier("narrow")).toBe(1.08);
  });
  it("applies no penalty for standard", () => {
    expect(machineAccessLabourMultiplier("standard")).toBe(1.0);
  });
});

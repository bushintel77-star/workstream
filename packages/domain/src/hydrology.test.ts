import { describe, it, expect } from "vitest";
import {
  calculateHydraulicRun,
  calculateHydraulicRuns,
  type HydraulicRun,
} from "./hydrology";

describe("hydrology (Hazen-Williams)", () => {
  const sampleRun: HydraulicRun = {
    id: "run-1",
    flowLps: 0.5, // ~7.9 GPM
    pipeDiameterMm: 25, // 1" PVC
    lengthM: 30,
    cFactor: 150, // PVC
  };

  it("calculates pressure drop and GPM for a valid run", () => {
    const result = calculateHydraulicRun(sampleRun);
    expect(result.valid).toBe(true);
    expect(result.gpm).toBeCloseTo(7.93, 1);
    expect(result.pressureDropKpa).toBeGreaterThan(0);
    expect(result.velocityMs).toBeGreaterThan(0);
  });

  it("returns invalid for non-positive flow", () => {
    const result = calculateHydraulicRun({ ...sampleRun, flowLps: 0 });
    expect(result.valid).toBe(false);
    expect(result.invalidReason).toContain("Non-positive");
  });

  it("returns invalid for non-positive diameter", () => {
    const result = calculateHydraulicRun({ ...sampleRun, pipeDiameterMm: 0 });
    expect(result.valid).toBe(false);
  });

  it("calculates velocity from flow and pipe area", () => {
    const result = calculateHydraulicRun(sampleRun);
    // v = Q/A = 0.0005 m³/s / (π × 0.0125²) ≈ 1.02 m/s
    expect(result.velocityMs).toBeCloseTo(1.02, 1);
  });

  it("excludes origin-anchored runs (hydraulic isolation §5)", () => {
    const results = calculateHydraulicRuns([
      { ...sampleRun, id: "real-run" },
      { ...sampleRun, id: "origin-run", startIsOrigin: true },
    ]);
    const originResult = results.find((r) => r.runId === "origin-run");
    expect(originResult?.valid).toBe(false);
    expect(originResult?.invalidReason).toContain("hydraulic isolation");
  });

  it("higher flow produces higher pressure drop", () => {
    const low = calculateHydraulicRun({ ...sampleRun, flowLps: 0.3 });
    const high = calculateHydraulicRun({ ...sampleRun, flowLps: 1.0 });
    expect(high.pressureDropKpa).toBeGreaterThan(low.pressureDropKpa);
  });

  it("longer pipe produces higher pressure drop", () => {
    const short_ = calculateHydraulicRun({ ...sampleRun, lengthM: 10 });
    const long_ = calculateHydraulicRun({ ...sampleRun, lengthM: 100 });
    expect(long_.pressureDropKpa).toBeGreaterThan(short_.pressureDropKpa);
  });
});

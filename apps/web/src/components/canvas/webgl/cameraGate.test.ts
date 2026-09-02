import { describe, expect, it } from "vitest";
import { orbitAllowedForPreset } from "./cameraGate";

describe("orbitAllowedForPreset — per-rig orbit law (1.4)", () => {
  it("never orbits in the two true-measurement views", () => {
    expect(orbitAllowedForPreset("plan")).toBe(false);
    expect(orbitAllowedForPreset("sec")).toBe(false);
  });

  it("orbits only in the two volume views", () => {
    expect(orbitAllowedForPreset("axo")).toBe(true);
    expect(orbitAllowedForPreset("3d")).toBe(true);
  });
});

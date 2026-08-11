import { describe, expect, it } from "vitest";
import {
  allowAerialUnderlay,
  isDraftingPlate,
  resolveLiveAerial,
} from "./studioPlane";

describe("studioPlane", () => {
  it("treats cad, sketch and garden as drafting plates", () => {
    expect(isDraftingPlate("cad")).toBe(true);
    expect(isDraftingPlate("sketch")).toBe(true);
    expect(isDraftingPlate("garden")).toBe(true);
    expect(isDraftingPlate("survey")).toBe(false);
  });

  it("never resolves satellite aerial on CAD / sketch unless plan underlay", () => {
    const uri = "data:image/png;base64,xx";
    expect(
      resolveLiveAerial({
        mode: "cad",
        foundationCleanse: false,
        aerialSuppressed: false,
        aerialUri: uri,
      }),
    ).toBeNull();
    expect(
      resolveLiveAerial({
        mode: "cad",
        foundationCleanse: false,
        aerialSuppressed: false,
        aerialUri: uri,
        allowPlanUnderlay: true,
      }),
    ).toBe(uri);
    expect(
      resolveLiveAerial({
        mode: "survey",
        foundationCleanse: true,
        aerialSuppressed: false,
        aerialUri: uri,
      }),
    ).toBeNull();
    expect(
      resolveLiveAerial({
        mode: "survey",
        foundationCleanse: false,
        aerialSuppressed: true,
        aerialUri: uri,
      }),
    ).toBeNull();
  });

  it("allows survey aerial when not suppressed", () => {
    const uri = "data:image/png;base64,xx";
    expect(
      resolveLiveAerial({
        mode: "survey",
        foundationCleanse: false,
        aerialSuppressed: false,
        aerialUri: uri,
      }),
    ).toBe(uri);
  });

  it("gates satellite aerial underlay to survey only", () => {
    expect(
      allowAerialUnderlay({ mode: "survey", foundationCleanse: false }),
    ).toBe(true);
    expect(allowAerialUnderlay({ mode: "cad", foundationCleanse: false })).toBe(
      false,
    );
    expect(
      allowAerialUnderlay({ mode: "survey", foundationCleanse: true }),
    ).toBe(false);
  });
});

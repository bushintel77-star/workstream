import { describe, expect, it } from "vitest";
import {
  RESCODE_A2_6,
  assessCanopyCompliance,
  isMatureCanopyTree,
  requiredCanopyTrees,
  type CanopyTreeCandidate,
} from "./rescode-canopy";

const matureTree = (over: Partial<CanopyTreeCandidate> = {}): CanopyTreeCandidate => ({
  id: over.id ?? "tree-1",
  matureHeightM: over.matureHeightM ?? 8,
  matureCanopyRadiusM: over.matureCanopyRadiusM ?? 3,
  ...over,
});

describe("requiredCanopyTrees", () => {
  it("rounds up per 100 m² (safe direction — never under-warns)", () => {
    expect(requiredCanopyTrees(250)).toBe(3);
    expect(requiredCanopyTrees(300)).toBe(3);
    expect(requiredCanopyTrees(450)).toBe(5);
    expect(requiredCanopyTrees(90)).toBe(1);
    expect(requiredCanopyTrees(100)).toBe(1);
    expect(requiredCanopyTrees(101)).toBe(2);
  });

  it("unknown or non-positive area is insufficient data, never a silent pass", () => {
    expect(requiredCanopyTrees(null)).toBeNull();
    expect(requiredCanopyTrees(undefined)).toBeNull();
    expect(requiredCanopyTrees(0)).toBeNull();
    expect(requiredCanopyTrees(Number.NaN)).toBeNull();
  });
});

describe("isMatureCanopyTree", () => {
  it("passes at exactly the maturity minimums (6 m height, 4 m canopy width)", () => {
    expect(isMatureCanopyTree(matureTree({ matureHeightM: 6, matureCanopyRadiusM: 2 }))).toBe(true);
  });

  it("fails below either minimum", () => {
    expect(isMatureCanopyTree(matureTree({ matureHeightM: 5.9 }))).toBe(false);
    expect(isMatureCanopyTree(matureTree({ matureCanopyRadiusM: 1.99 }))).toBe(false);
  });

  it("unknown dimensions do not pass — unproven is not proven", () => {
    expect(isMatureCanopyTree(matureTree({ matureHeightM: null }))).toBe(false);
    expect(isMatureCanopyTree(matureTree({ matureCanopyRadiusM: undefined }))).toBe(false);
  });
});

describe("assessCanopyCompliance", () => {
  it("insufficient-data when site area is unknown", () => {
    const r = assessCanopyCompliance({ siteAreaM2: null, trees: [matureTree()] });
    expect(r.status).toBe("insufficient-data");
    expect(r.required).toBeNull();
  });

  it("shortfall with zero trees on a 450 m² lot", () => {
    const r = assessCanopyCompliance({ siteAreaM2: 450, trees: [] });
    expect(r.status).toBe("shortfall");
    if (r.status === "insufficient-data") throw new Error("unreachable");
    expect(r.required).toBe(5);
    expect(r.matureProvided).toBe(0);
    expect(r.shortfall).toBe(5);
    expect(r.immature).toHaveLength(0);
  });

  it("mixed mature/immature: only mature trees count; immature carry reasons", () => {
    const r = assessCanopyCompliance({
      siteAreaM2: 250, // requires 3 (ceil)
      trees: [
        matureTree({ id: "t-vicmap", label: "Eucalyptus · 9 m", source: "vicmap_tree" }),
        matureTree({ id: "t-short", matureHeightM: 4 }),
        matureTree({ id: "t-thin", matureCanopyRadiusM: 1.5 }),
        matureTree({ id: "t-unknown", matureHeightM: null, matureCanopyRadiusM: null }),
      ],
    });
    expect(r.status).toBe("shortfall");
    if (r.status === "insufficient-data") throw new Error("unreachable");
    expect(r.provided).toBe(4);
    expect(r.matureProvided).toBe(1);
    expect(r.shortfall).toBe(2);
    expect(r.immature.map((t) => [t.id, t.reason])).toEqual([
      ["t-short", "height"],
      ["t-thin", "canopy-width"],
      ["t-unknown", "unknown-dimensions"],
    ]);
  });

  it("compliant when mature trees meet the requirement", () => {
    const r = assessCanopyCompliance({
      siteAreaM2: 300, // requires 3
      trees: [matureTree({ id: "a" }), matureTree({ id: "b" }), matureTree({ id: "c" })],
    });
    expect(r.status).toBe("compliant");
    if (r.status === "insufficient-data") throw new Error("unreachable");
    expect(r.shortfall).toBe(0);
  });

  it("carries the standard identity on every result for honest stamping", () => {
    for (const r of [
      assessCanopyCompliance({ siteAreaM2: null, trees: [] }),
      assessCanopyCompliance({ siteAreaM2: 100, trees: [matureTree()] }),
    ]) {
      expect(r.standard.standardId).toBe("A2-6");
      expect(r.standard.clause).toBe("54.02-6");
      expect(r.standard.amendment).toBe("VC298");
      expect(RESCODE_A2_6.minHeightM).toBe(6);
      expect(RESCODE_A2_6.minCanopyWidthM).toBe(4);
    }
  });
});

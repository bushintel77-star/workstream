import { describe, expect, it } from "vitest";
import {
  councilDrainageChase,
  defaultSitePackChase,
  digToolsUnlocked,
  prepareSitePackTip,
} from "./prepare-site-pack";

describe("prepareSitePackTip", () => {
  it("summarises gates for the operator", () => {
    const tip = prepareSitePackTip({
      titleOk: true,
      overlayCount: 4,
      treeGhostCount: 3,
      chasePending: 2,
    });
    expect(tip).toContain("Title + dwelling");
    expect(tip).toContain("3 exist tree");
    expect(tip).toContain("2 chase");
  });
});

describe("councilDrainageChase", () => {
  it("routes Stonnington LGA to council contact", () => {
    const c = councilDrainageChase("363", "City of Stonnington");
    expect(c.href).toContain("stonnington");
    expect(c.requestTemplate.toLowerCase()).toContain("discharge");
  });

  it("falls back to Vic council finder", () => {
    const c = councilDrainageChase(null, null);
    expect(c.href).toContain("find-my-local-council");
  });
});

describe("defaultSitePackChase", () => {
  it("includes CoT, BYDA, council drain, arbor", () => {
    const chase = defaultSitePackChase({ lgaCode: "363" });
    expect(chase.map((c) => c.id)).toEqual([
      "cot",
      "byda",
      "council_drain",
      "arbor",
    ]);
    expect(chase.every((c) => !c.done)).toBe(true);
  });
});

describe("digToolsUnlocked", () => {
  it("requires BYDA assets or override", () => {
    expect(digToolsUnlocked({ bydaAssetCount: 0 })).toBe(false);
    expect(digToolsUnlocked({ bydaAssetCount: 1 })).toBe(true);
    expect(
      digToolsUnlocked({
        bydaAssetCount: 0,
        digOverrideAt: "2026-07-24T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

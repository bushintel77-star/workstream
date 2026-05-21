import { describe, expect, it } from "vitest";
import {
  isTier1WrightsTerrace,
  tier1WrightsTerraceDesign,
  TIER1_WRIGHTS_SAVINGS,
} from "./tier1-wrights-terrace";

describe("isTier1WrightsTerrace", () => {
  it("matches Wrights Terrace in Prahran", () => {
    expect(isTier1WrightsTerrace("36 Wrights Terrace, Prahran VIC 3181")).toBe(
      true,
    );
    expect(isTier1WrightsTerrace("36 Wrights Tce, Prahran")).toBe(true);
  });

  it("rejects other sites", () => {
    expect(isTier1WrightsTerrace("12 Smith St, Richmond")).toBe(false);
    expect(isTier1WrightsTerrace("36 Wrights Terrace, Brighton")).toBe(false);
  });
});

describe("TIER1_WRIGHTS_SAVINGS", () => {
  it("matches Curtis Proposal v3 ledger", () => {
    expect(TIER1_WRIGHTS_SAVINGS.removed_ex).toBe(3820.5);
    expect(TIER1_WRIGHTS_SAVINGS.deployed_ex).toBe(2860);
    expect(TIER1_WRIGHTS_SAVINGS.net_ex).toBe(-960.5);
    expect(TIER1_WRIGHTS_SAVINGS.net_inc_gst).toBeCloseTo(-1191.96, 2);
    expect(TIER1_WRIGHTS_SAVINGS.target_total_inc_gst).toBe(58410.35);
  });
});

describe("tier1WrightsTerraceDesign", () => {
  it("returns front-entry and rear-courtyard zones", () => {
    const d = tier1WrightsTerraceDesign({
      address: "36 Wrights Terrace, Prahran",
      mode: "validate",
    });
    const ids = d.proposal.zones.map((z) => z.id);
    expect(ids).toEqual(["front-entry", "rear-courtyard"]);
    expect(d.proposal.estimated_complexity).toBe("complex");
    expect(d.gaps.length).toBeGreaterThan(0);
    expect(d.gaps[0]?.zone).toBe("front-entry");
  });
});

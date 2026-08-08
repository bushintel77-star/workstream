/**
 * Tier-1 stress battery — address gate, savings invariants, design stability.
 * Run: pnpm exec vitest run packages/domain/src/tier1-wrights-terrace.stress.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  isTier1WrightsTerrace,
  tier1WrightsTerraceDesign,
  TIER1_WRIGHTS_SAVINGS,
} from "./tier1-wrights-terrace";
import { alignCadBuildToTier1Workbook } from "./cad-build";
import type { CadBuildSchedule } from "./cad-build";

const POSITIVE: string[] = [
  "36 Wrights Terrace, Prahran VIC 3181",
  "36 Wrights Tce, Prahran",
  "12 Wrights Terrace, Prahran",
  "WRIGHTS TERRACE, PRAHRAN",
  "  36   Wrights   Terrace , Prahran  ",
  "36 Wrights Ter, Prahran VIC",
  "36 Wrights Terrace\nPrahran VIC 3181",
  "Unit 1/36 Wrights Terrace, Prahran",
  "36 Wrights Terrace Prahran 3181",
  "36 wrights tce prahran",
];

const NEGATIVE: string[] = [
  "",
  "Prahran",
  "Wrights Terrace",
  "36 Wrights Terrace, Brighton",
  "36 Wrights Terrace, South Yarra",
  "12 Smith St, Richmond",
  "36 Wright Street, Prahran",
  "Wrights Road, Prahran",
  "36 Wrights Parade, Prahran",
  "36 Terrace Wrights, Prahran",
];

function fakeCadBuild(total: number): CadBuildSchedule {
  const subtotal = Math.round((total / 1.1) * 100) / 100;
  const gst = Math.round((total - subtotal) * 100) / 100;
  return {
    survey: {
      project_id: "stress",
      committed_only: true,
      rows: [],
      totals: {
        hardscape_m2: 0,
        planting_ea: 0,
        irrigation_lm: 0,
        structure_m2: 0,
        other_m2: 0,
        other_lm: 0,
        other_ea: 0,
      },
    },
    scenario: "standard",
    line_items: [
      {
        sku: "TEST-LINE",
        label: "Stress line",
        unit: "ea",
        qty: 1,
        rate: subtotal,
        total: subtotal,
      },
    ],
    subtotal,
    contingency: 0,
    gst,
    total,
  };
}

describe("tier-1 stress · address gate", () => {
  it("accepts every positive Wrights+Prahran variant", () => {
    for (const address of POSITIVE) {
      expect(isTier1WrightsTerrace(address), address).toBe(true);
    }
  });

  it("rejects every negative / near-miss address", () => {
    for (const address of NEGATIVE) {
      expect(isTier1WrightsTerrace(address), JSON.stringify(address)).toBe(
        false,
      );
    }
  });

  it("fuzzes 500 synthetic addresses without false positives outside Prahran", () => {
    let positives = 0;
    for (let i = 0; i < 500; i++) {
      const street = i % 3 !== 2 ? "Wrights Terrace" : `Sample St ${i}`;
      const suburb = i % 2 === 0 ? "Prahran" : "Richmond";
      const address = `${10 + (i % 90)} ${street}, ${suburb} VIC 3${100 + (i % 80)}`;
      const hit = isTier1WrightsTerrace(address);
      if (street.includes("Wrights") && suburb === "Prahran") {
        expect(hit, address).toBe(true);
        positives += 1;
      } else {
        expect(hit, address).toBe(false);
      }
    }
    expect(positives).toBeGreaterThan(100);
  });
});

describe("tier-1 stress · savings ledger invariants", () => {
  it("keeps Curtis Proposal v3 ledger constants stable under repeated reads", () => {
    for (let i = 0; i < 200; i++) {
      const s = TIER1_WRIGHTS_SAVINGS;
      // net_ex is capital redeployed − removed (negative = net save ex-GST).
      expect(s.deployed_ex - s.removed_ex).toBeCloseTo(s.net_ex, 10);
      // Inc-GST line is proposal-authored (not a naive ×1.1 of net_ex).
      expect(s.net_inc_gst).toBeCloseTo(-1191.96, 2);
      expect(s.removed_ex).toBe(3820.5);
      expect(s.deployed_ex).toBe(2860);
      expect(s.target_total_inc_gst).toBe(58410.35);
    }
  });
});

describe("tier-1 stress · design generation stability", () => {
  it("returns identical zone shape across 100 calls", () => {
    const first = tier1WrightsTerraceDesign({
      address: "36 Wrights Terrace, Prahran",
      mode: "validate",
    });
    for (let i = 0; i < 100; i++) {
      const next = tier1WrightsTerraceDesign({
        address: `36 Wrights Tce, Prahran #${i}`,
        mode: i % 2 === 0 ? "validate" : "generate",
      });
      expect(next.proposal.zones.map((z) => z.id)).toEqual(
        first.proposal.zones.map((z) => z.id),
      );
      expect(next.proposal.estimated_complexity).toBe("complex");
      expect(next.gaps.length).toBe(first.gaps.length);
      const plantCount = next.proposal.zones.reduce(
        (n, z) => n + z.plantings.length,
        0,
      );
      expect(plantCount).toBeGreaterThan(5);
    }
  });
});

describe("tier-1 stress · CAD workbook align", () => {
  it("locks divergent standard totals onto 58410.35 for Wrights only", () => {
    const totals = [40_000, 50_000, 58_410.35, 70_000, 12_345.67];
    for (const total of totals) {
      const aligned = alignCadBuildToTier1Workbook(
        fakeCadBuild(total),
        "36 Wrights Terrace, Prahran VIC 3181",
      );
      expect(aligned.total).toBe(58410.35);
      if (Math.abs(total - 58410.35) >= 0.02) {
        expect(aligned.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
          true,
        );
      }
    }
  });

  it("never aligns non-Wrights addresses", () => {
    const aligned = alignCadBuildToTier1Workbook(
      fakeCadBuild(40_000),
      "12 Smith St, Richmond",
    );
    expect(aligned.total).toBe(40_000);
    expect(aligned.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
      false,
    );
  });

  it("stresses align path 300 times for determinism", () => {
    for (let i = 0; i < 300; i++) {
      const seed = 20_000 + i * 137.11;
      const aligned = alignCadBuildToTier1Workbook(
        fakeCadBuild(seed),
        "36 Wrights Terrace, Prahran",
      );
      expect(aligned.total).toBe(58410.35);
      expect(aligned.gst).toBe(
        Math.round((58410.35 - Math.round((58410.35 / 1.1) * 100) / 100) * 100) /
          100,
      );
    }
  });
});

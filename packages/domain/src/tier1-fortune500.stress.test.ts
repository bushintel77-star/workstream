/**
 * Fortune-500 Tier-1 hardness — address corpus, money lock, scenario isolation.
 * Run: pnpm exec vitest run packages/domain/src/tier1-fortune500.stress.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  isTier1WrightsTerrace,
  tier1WrightsTerraceDesign,
  TIER1_WRIGHTS_SAVINGS,
} from "./tier1-wrights-terrace";
import { alignCadBuildToTier1Workbook } from "./cad-build";
import type { CadBuildSchedule } from "./cad-build";
import {
  buildGhostPlacementSuggestions,
  buildStudioAiSuggestions,
} from "./studio-ai-assist";

const TARGET = TIER1_WRIGHTS_SAVINGS.target_total_inc_gst;

/** Near-miss corpus — must never unlock Tier-1. */
const ADVERSARIAL_NEGATIVE: string[] = [
  "36 Wrights Terrace, Brighton VIC 3186",
  "36 Wrights Terrace, South Yarra VIC 3141",
  "36 Wright Street, Prahran VIC 3181",
  "Wrights Road, Prahran VIC 3181",
  "36 Wrights Parade, Prahran",
  "36 Wrights Place, Prahran",
  "36 Wrights Court, Prahran",
  "Wrights Tce Prahan", // misspelt suburb
  "36 Wrights Terr., Toorak",
  "36 Wrights Terrace",
  "Prahran VIC 3181",
  "Wrights",
  "36 Fake Wrights Terrace, Richmond",
  "36 Wrights Terrace, Richmond VIC 3121",
];

/** Noise / injection envelopes that still contain Wrights + Prahran — gate stays on. */
const NOISY_POSITIVE: string[] = [
  "Prahran Wrights Terrace",
  "Wrights Terrace Shopping Centre, Prahran",
  "javascript:36 Wrights Terrace, Prahran",
  "<script>36 Wrights Terrace, Prahran</script>",
  "36 Wrights Terrace, Prahran; DROP TABLE projects;",
  "36 Wrights Terrace, Prahran\u200b",
];

/**
 * Explicit positives that enterprise address feeds may emit
 * (OCR noise, unit prefixes, AU abbreviations).
 */
const ENTERPRISE_POSITIVE: string[] = [
  "36 Wrights Terrace, Prahran VIC 3181",
  "36 WRIGHTS TCE, PRAHRAN",
  "Lot 2, 36 Wrights Terrace, Prahran",
  "36 Wrights Ter., Prahran, VIC, 3181, Australia",
  "c/- Owner, 36 Wrights Terrace, Prahran",
  "36 Wrights Terrace  Prahran  VIC  3181",
];

function fakeCadBuild(
  total: number,
  scenario: CadBuildSchedule["scenario"] = "standard",
): CadBuildSchedule {
  const subtotal = Math.round((total / 1.1) * 100) / 100;
  const gst = Math.round((total - subtotal) * 100) / 100;
  return {
    survey: {
      project_id: "f500",
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
    scenario,
    line_items: [
      {
        sku: "TEST-LINE",
        label: "Fortune stress line",
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

describe("fortune-500 · address gate corpus", () => {
  it("accepts enterprise address feed positives", () => {
    for (const address of ENTERPRISE_POSITIVE) {
      expect(isTier1WrightsTerrace(address), address).toBe(true);
    }
  });

  it("rejects adversarial near-misses", () => {
    for (const address of ADVERSARIAL_NEGATIVE) {
      expect(isTier1WrightsTerrace(address), JSON.stringify(address)).toBe(
        false,
      );
    }
  });

  it("still gates on when Wrights+Prahran survive noise envelopes", () => {
    for (const address of NOISY_POSITIVE) {
      expect(isTier1WrightsTerrace(address), address).toBe(true);
    }
  });

  it("fuzzes 2000 synthetic addresses with zero false positives outside Prahran", () => {
    const suburbs = [
      "Prahran",
      "Richmond",
      "Carlton",
      "Brighton",
      "Armadale",
      "Toorak",
      "South Yarra",
      "Fitzroy",
    ];
    const streets = [
      "Wrights Terrace",
      "Wrights Tce",
      "Wrights Ter",
      "Wright Street",
      "Wrights Road",
      "Sample St",
      "Chapel St",
      "High St",
    ];
    let positives = 0;
    for (let i = 0; i < 2000; i++) {
      const street = streets[i % streets.length]!;
      const suburb = suburbs[i % suburbs.length]!;
      const address = `${1 + (i % 200)} ${street}, ${suburb} VIC ${3000 + (i % 200)}`;
      const hit = isTier1WrightsTerrace(address);
      const should =
        /wrights?\s*t(er(race)?)?/i.test(street) && /prahran/i.test(suburb);
      expect(hit, address).toBe(should);
      if (should) positives += 1;
    }
    expect(positives).toBeGreaterThan(200);
  });
});

describe("fortune-500 · money lock + scenario isolation", () => {
  it("GST + subtotal on aligned Wrights builds always reconstitute the target", () => {
    for (let i = 0; i < 500; i++) {
      const seed = 15_000 + i * 91.7;
      const aligned = alignCadBuildToTier1Workbook(
        fakeCadBuild(seed),
        "36 Wrights Terrace, Prahran VIC 3181",
      );
      expect(aligned.total).toBe(TARGET);
      expect(
        Math.round((aligned.subtotal + aligned.gst) * 100) / 100,
      ).toBe(TARGET);
      expect(aligned.contingency).toBe(0);
    }
  });

  it("never aligns lean or buffer scenarios even on Wrights", () => {
    for (const scenario of ["lean", "buffer"] as const) {
      for (const total of [40_000, 58_410.35, 90_000]) {
        const aligned = alignCadBuildToTier1Workbook(
          fakeCadBuild(total, scenario),
          "36 Wrights Terrace, Prahran",
        );
        expect(aligned.total).toBe(total);
        expect(
          aligned.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN"),
        ).toBe(false);
      }
    }
  });

  it("align is idempotent under double application (1000×)", () => {
    for (let i = 0; i < 1000; i++) {
      const once = alignCadBuildToTier1Workbook(
        fakeCadBuild(22_000 + i),
        "36 Wrights Terrace, Prahran",
      );
      const twice = alignCadBuildToTier1Workbook(
        once,
        "36 Wrights Terrace, Prahran",
      );
      expect(twice.total).toBe(TARGET);
      expect(twice.line_items.filter((l) => l.sku === "ALW-TIER1-ALIGN").length).toBe(
        once.line_items.filter((l) => l.sku === "ALW-TIER1-ALIGN").length,
      );
      expect(twice).toEqual(once);
    }
  });
});

describe("fortune-500 · design massing stability", () => {
  it("holds zone DNA across 500 mode/address variants", () => {
    const first = tier1WrightsTerraceDesign({
      address: "36 Wrights Terrace, Prahran",
      mode: "validate",
    });
    const zoneIds = first.proposal.zones.map((z) => z.id).sort();
    expect(zoneIds).toEqual(["front-entry", "rear-courtyard"].sort());

    for (let i = 0; i < 500; i++) {
      const next = tier1WrightsTerraceDesign({
        address: `${12 + (i % 40)} Wrights Tce, Prahran #${i}`,
        mode: i % 3 === 0 ? "validate" : i % 3 === 1 ? "generate" : "refine",
      });
      expect(next.proposal.zones.map((z) => z.id).sort()).toEqual(zoneIds);
      expect(next.proposal.estimated_complexity).toBe("complex");
      const plants = next.proposal.zones.reduce(
        (n, z) => n + z.plantings.length,
        0,
      );
      expect(plants).toBeGreaterThan(5);
    }
  });
});

describe("fortune-500 · AI coaching honesty", () => {
  it("never emits tier1-massing when tier1 flag is false (200×)", () => {
    for (let i = 0; i < 200; i++) {
      const s = buildStudioAiSuggestions({
        placementCount: i % 5,
        strokeCount: i % 3,
        zoneCount: i % 2,
        hasPlanningSymbol: i % 2 === 0,
        tier1: false,
        hasDesign: i % 4 === 0,
      });
      expect(s.some((x) => x.id === "tier1-massing")).toBe(false);
    }
  });

  it("always surfaces tier1-massing + quote action when tier1 is true", () => {
    for (let i = 0; i < 100; i++) {
      const s = buildStudioAiSuggestions({
        placementCount: i % 6,
        strokeCount: 0,
        zoneCount: 0,
        hasPlanningSymbol: false,
        tier1: true,
        hasDesign: false,
      });
      expect(s.some((x) => x.id === "tier1-massing")).toBe(true);
      expect(s.some((x) => x.action === "quote")).toBe(true);
    }
  });

  it("tier-1 hornbeam ghost id only when tier1 flag is true", () => {
    const withTier1 = buildGhostPlacementSuggestions({
      tier1: true,
      symbolIds: ["hornbeam-pleached", "bluestone-paver"],
    });
    const without = buildGhostPlacementSuggestions({
      tier1: false,
      symbolIds: ["hornbeam-pleached", "bluestone-paver"],
    });
    expect(withTier1.some((g) => g.id === "ghost-tier1-hornbeam")).toBe(true);
    expect(without.some((g) => g.id === "ghost-tier1-hornbeam")).toBe(false);
    // Non-tier-1 may still suggest a generic canopy ghost from the same SKU.
    expect(without.some((g) => g.id === "ghost-tree")).toBe(true);
  });
});

describe("fortune-500 · savings ledger audit constants", () => {
  it("proposal v3 arithmetic holds under 1000 re-reads", () => {
    for (let i = 0; i < 1000; i++) {
      const s = TIER1_WRIGHTS_SAVINGS;
      expect(s.deployed_ex - s.removed_ex).toBeCloseTo(s.net_ex, 10);
      expect(s.target_total_inc_gst).toBe(58410.35);
      expect(s.net_inc_gst).toBeCloseTo(-1191.96, 2);
    }
  });
});

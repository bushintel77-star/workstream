import { describe, expect, it } from "vitest";
import { buildBoardContext, type BoardContextInput } from "./board-context";
import {
  buildBoardFindings,
  formatBoardFindingsForAi,
  type BoardFinding,
} from "./board-findings";

/** Board is 40 m across 100% width, so 1 m = 2.5%. */
const SCALE_M = 40;

const DWELLING = [
  { x: 20, y: 10 },
  { x: 60, y: 10 },
  { x: 60, y: 30 },
  { x: 20, y: 30 },
];

function ctxOf(input: BoardContextInput) {
  return buildBoardContext({
    ...input,
    meta: { project_id: "p1", scale_m: SCALE_M, ...input.meta },
  });
}

function tree(code: string, x: number, y: number, spread: number) {
  return { code, species: `${code} sp.`, x, y, mature_spread_m: spread };
}

function find(findings: BoardFinding[], id: string) {
  return findings.find((f) => f.id === id);
}

describe("canopy findings", () => {
  it("flags a Year-10 canopy closing over the dwelling", () => {
    const ctx = ctxOf({
      geometry: { building: DWELLING, outdoor_m2: 300 },
      planting: [tree("B01", 50, 38, 8)],
    });
    const hit = buildBoardFindings(ctx).find(
      (f) => f.title === "Year-10 canopy reaches the dwelling",
    );
    expect(hit).toBeDefined();
    expect(hit!.cites).toContain("geometry.building");
    expect(hit!.severity).toBe("watch");
  });

  it("leaves a tree clear of the dwelling alone", () => {
    const ctx = ctxOf({
      geometry: { building: DWELLING, outdoor_m2: 300 },
      planting: [tree("B01", 50, 80, 8)],
    });
    const hit = buildBoardFindings(ctx).find(
      (f) => f.title === "Year-10 canopy reaches the dwelling",
    );
    expect(hit).toBeUndefined();
  });

  it("flags trees whose mature canopies close over each other", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 300 },
      planting: [tree("B01", 10, 80, 8), tree("B02", 20, 80, 8)],
    });
    const crowd = buildBoardFindings(ctx).filter(
      (f) => f.title === "Canopies close over each other at maturity",
    );
    // A crowding B is the same conflict as B crowding A — reported once.
    expect(crowd).toHaveLength(1);
    expect(crowd[0]!.cites).toEqual(["B01 @ 10%,80%", "B02 @ 20%,80%"]);
  });

  it("distinguishes placements that share a schedule code", () => {
    const ctx = ctxOf({
      geometry: { building: DWELLING, outdoor_m2: 300 },
      // Twelve of B14 is normal — a code alone cannot identify which one.
      planting: [tree("B14", 40, 38, 8), tree("B14", 55, 38, 8)],
    });
    const hits = buildBoardFindings(ctx).filter(
      (f) => f.title === "Year-10 canopy reaches the dwelling",
    );
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((f) => f.cites[0]))).toEqual(
      new Set(["B14 @ 40%,38%", "B14 @ 55%,38%"]),
    );
  });

  it("does not claim spacing without a ground scale", () => {
    const ctx = ctxOf({
      meta: { project_id: "p1", scale_m: null },
      geometry: { building: DWELLING, outdoor_m2: 300 },
      planting: [tree("B01", 10, 80, 8), tree("B02", 20, 80, 8)],
    });
    const findings = buildBoardFindings(ctx);
    expect(
      findings.some((f) => f.title === "Canopies close over each other at maturity"),
    ).toBe(false);
    expect(
      findings.some((f) => f.title === "Year-10 canopy reaches the dwelling"),
    ).toBe(false);
  });

  it("flags turf sitting under a closing canopy", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 100 },
      planting: [tree("B01", 50, 50, 10)],
      surfaces: [{ type: "lawn", area_m2: 60, permeable: true }],
    });
    const hit = find(buildBoardFindings(ctx), "bf-canopy-turf");
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain("turf");
  });

  it("flags canopy short of the benchmark", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 1000 },
      planting: [tree("B01", 50, 50, 2)],
      compliance: { canopy_target: 15 },
    });
    const hit = find(buildBoardFindings(ctx), "bf-canopy-target");
    expect(hit).toBeDefined();
    expect(hit!.title).toContain("15%");
  });
});

describe("dig findings", () => {
  const trench = {
    id: "t1",
    name: "LV conduit",
    kind: "lighting_conduit",
    points: [
      { x_pct: 10, y_pct: 50 },
      { x_pct: 90, y_pct: 50 },
    ],
  };

  it("flags a trench crossing a located utility", () => {
    const ctx = ctxOf({
      systems: {
        trenches: [trench],
        byda_assets: [
          {
            id: "b1",
            kind: "sewer",
            ring: [
              { x_pct: 50, y_pct: 20 },
              { x_pct: 50, y_pct: 80 },
            ],
          },
        ],
      },
    });
    const hit = find(buildBoardFindings(ctx), "bf-dig-t1-b1");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("critical");
    expect(hit!.detail).toContain("Confirm-locate");
  });

  it("leaves a trench that misses every asset alone", () => {
    const ctx = ctxOf({
      systems: {
        trenches: [trench],
        byda_assets: [
          {
            id: "b1",
            kind: "sewer",
            ring: [
              { x_pct: 50, y_pct: 70 },
              { x_pct: 50, y_pct: 90 },
            ],
          },
        ],
      },
    });
    expect(find(buildBoardFindings(ctx), "bf-dig-t1-b1")).toBeUndefined();
  });

  it("flags a trench crossing a traced service corridor", () => {
    const ctx = ctxOf({
      systems: {
        trenches: [trench],
        services: [
          [
            { x: 50, y: 20 },
            { x: 50, y: 80 },
          ],
        ],
        byda_assets: [{ id: "b1", kind: "sewer", ring: [{ x_pct: 5, y_pct: 5 }, { x_pct: 6, y_pct: 6 }] }],
      },
    });
    const hit = find(buildBoardFindings(ctx), "bf-dig-t1-service-0");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("critical");
  });

  it("says so when trenches are drawn with nothing located", () => {
    const ctx = ctxOf({ systems: { trenches: [trench] } });
    const hit = find(buildBoardFindings(ctx), "bf-dig-no-byda");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("watch");
  });

  it("ignores ghost trenches — they are proposals, not board state", () => {
    const ctx = ctxOf({
      systems: { trenches: [{ ...trench, ghost: true }] },
    });
    expect(buildBoardFindings(ctx).some((f) => f.kind === "dig_conflict")).toBe(
      false,
    );
  });
});

describe("permeability findings", () => {
  it("flags a breach tied to the actual sealed surfaces", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 100 },
      surfaces: [
        { type: "paving", area_m2: 90, material: "Bluestone paver", permeable: false },
      ],
      compliance: { permeability_target: 20 },
    });
    const hit = find(buildBoardFindings(ctx), "bf-permeability");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("critical");
    expect(hit!.cites).toContain("Bluestone paver");
  });

  it("stays silent when the surfaces carry no measured area", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 100 },
      surfaces: [{ type: "paving", permeable: false }],
      compliance: { permeability_target: 20 },
    });
    expect(find(buildBoardFindings(ctx), "bf-permeability")).toBeUndefined();
  });

  it("stays silent without an outdoor area to measure against", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "paving", area_m2: 90, permeable: false }],
      compliance: { permeability_target: 20 },
    });
    expect(find(buildBoardFindings(ctx), "bf-permeability")).toBeUndefined();
  });
});

describe("quote findings", () => {
  it("flags a drawn but uncosted board", () => {
    const ctx = ctxOf({ planting: [tree("B01", 50, 50, 4)] });
    const hit = find(buildBoardFindings(ctx), "bf-quote-uncosted");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("watch");
  });

  it("flags turf priced against a stale area", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "lawn", area_m2: 300, permeable: true }],
      commercial: {
        quote_lines: [
          { label: "Instant turf", qty: 200, unit: "m2", total: 9000 },
        ],
      },
    });
    const hit = find(buildBoardFindings(ctx), "bf-quote-turf-drift");
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain("300");
  });

  it("accepts a turf quantity within tolerance", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "lawn", area_m2: 300, permeable: true }],
      commercial: {
        quote_lines: [
          { label: "Instant turf", qty: 295, unit: "m2", total: 13275 },
        ],
      },
    });
    expect(find(buildBoardFindings(ctx), "bf-quote-turf-drift")).toBeUndefined();
  });

  it("flags planting that never reaches a priced line", () => {
    const ctx = ctxOf({
      planting: [{ ...tree("B01", 50, 50, 4), rate_card_sku: "PLT-CARP-PL24" }],
      commercial: {
        quote_lines: [
          { label: "Instant turf PLT-TURF", qty: 40, unit: "m2", total: 1800 },
        ],
      },
    });
    const hit = find(buildBoardFindings(ctx), "bf-quote-unpriced-planting");
    expect(hit).toBeDefined();
    expect(hit!.cites).toContain("PLT-CARP-PL24");
  });

  it("stays quiet when the SKU is on a line", () => {
    const ctx = ctxOf({
      planting: [{ ...tree("B01", 50, 50, 4), rate_card_sku: "PLT-CARP-PL24" }],
      commercial: {
        quote_lines: [
          {
            label: "Pleached hornbeam PLT-CARP-PL24",
            qty: 6,
            unit: "ea",
            total: 4200,
          },
        ],
      },
    });
    expect(
      find(buildBoardFindings(ctx), "bf-quote-unpriced-planting"),
    ).toBeUndefined();
  });
});

describe("sheet findings", () => {
  it("flags a board with no presentation pack", () => {
    const ctx = ctxOf({ planting: [tree("B01", 50, 50, 4)] });
    expect(find(buildBoardFindings(ctx), "bf-sheet-none")).toBeDefined();
  });

  it("flags a priced board whose sheet shows no quote", () => {
    const ctx = ctxOf({
      planting: [tree("B01", 50, 50, 4)],
      commercial: {
        quote_lines: [{ label: "Turf", qty: 40, unit: "m2", total: 1800 }],
        total_incl_gst: 1980,
      },
      sheet: { theme: "parchment", widgets: ["caption"] },
    });
    const hit = find(buildBoardFindings(ctx), "bf-sheet-no-quote");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("watch");
  });

  it("is satisfied once the quote widget is on the sheet", () => {
    const ctx = ctxOf({
      planting: [tree("B01", 50, 50, 4)],
      commercial: {
        quote_lines: [{ label: "Turf", qty: 40, unit: "m2", total: 1800 }],
      },
      sheet: { theme: "parchment", widgets: ["quote_total", "zone_summary"] },
    });
    expect(find(buildBoardFindings(ctx), "bf-sheet-no-quote")).toBeUndefined();
    expect(find(buildBoardFindings(ctx), "bf-sheet-no-zones")).toBeUndefined();
  });
});

describe("buildBoardFindings", () => {
  it("says nothing about an empty board", () => {
    expect(buildBoardFindings(ctxOf({}))).toEqual([]);
  });

  it("rests each claim on the weakest provenance behind it", () => {
    const ctx = ctxOf({
      geometry: { building: DWELLING, outdoor_m2: 300 },
      planting: [tree("B01", 50, 38, 8)],
      provenance: { building: "vicmap", planting: "operator" },
    });
    const hit = buildBoardFindings(ctx).find(
      (f) => f.title === "Year-10 canopy reaches the dwelling",
    );
    // Vicmap dwelling + operator sketch — the claim is only as good as the sketch.
    expect(hit!.basis).toBe("operator");
  });

  it("orders worst first and stays deterministic", () => {
    const input: BoardContextInput = {
      geometry: { outdoor_m2: 100 },
      surfaces: [
        { type: "paving", area_m2: 90, material: "Bluestone", permeable: false },
        { type: "lawn", area_m2: 60, permeable: true },
      ],
      planting: [tree("B02", 20, 80, 10), tree("B01", 10, 80, 10)],
      compliance: { permeability_target: 20, canopy_target: 15 },
      commercial: {
        quote_lines: [{ label: "Turf", qty: 10, unit: "m2", total: 450 }],
      },
      sheet: { theme: "parchment", widgets: [] },
    };
    const first = buildBoardFindings(ctxOf(input));
    const second = buildBoardFindings(ctxOf(input));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first[0]!.severity).toBe("critical");
    expect(first.map((f) => f.severity)).toEqual(
      [...first.map((f) => f.severity)].sort(
        (a, b) =>
          ["critical", "watch", "info"].indexOf(a) -
          ["critical", "watch", "info"].indexOf(b),
      ),
    );
  });
});

describe("formatBoardFindingsForAi", () => {
  it("cites artefacts and basis on every line", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 100 },
      surfaces: [{ type: "paving", area_m2: 90, material: "Bluestone", permeable: false }],
      compliance: { permeability_target: 20 },
    });
    const block = formatBoardFindingsForAi(buildBoardFindings(ctx));
    expect(block).toContain("[CRITICAL]");
    expect(block).toContain("cites:");
    expect(block).toContain("basis:");
  });

  it("says none rather than padding", () => {
    expect(formatBoardFindingsForAi([])).toContain("none");
  });
});

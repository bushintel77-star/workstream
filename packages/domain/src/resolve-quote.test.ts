import { describe, expect, it } from "vitest";
import {
  engineLinesFromStudioEstimate,
  quoteDocToShareLines,
  resolveQuote,
  sectionForEstimateTier,
  type QuoteEngineLine,
} from "./resolve-quote";
import type { StudioEstimateLine } from "./studio-preemptive-estimate";

const engine: QuoteEngineLine[] = [
  {
    id: "prim-pave",
    label: "Bluestone paving",
    unit: "m2",
    qty: 10,
    rate: 320,
    total: 3200,
    sku: "PAV-BLUE-SAWN",
    tier: "primary",
    sectionHint: "hardscape",
  },
  {
    id: "prim-lawn",
    label: "Lawn turf",
    unit: "m2",
    qty: 20,
    rate: 45,
    total: 900,
    tier: "primary",
    sectionHint: "planting",
  },
];

describe("resolveQuote", () => {
  it("matches live engine subtotal before overrides", () => {
    const result = resolveQuote(engine, {
      overrides: [],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    expect(result.subtotalExGst).toBe(4100);
    expect(result.taxableExGst).toBe(4100);
    expect(result.gst).toBe(410);
    expect(result.totalInclGst).toBe(4510);
    expect(result.orphanOverrides).toEqual([]);
  });

  it("applies qty/rate overrides and recomputes GST", () => {
    const result = resolveQuote(engine, {
      overrides: [{ line_id: "prim-pave", qty: 5, rate: 300 }],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    const pave = result.lines.find((l) => l.id === "prim-pave")!;
    expect(pave.total).toBe(1500);
    expect(pave.overridden).toBe(true);
    expect(result.taxableExGst).toBe(2400);
    expect(result.gst).toBe(240);
    expect(result.totalInclGst).toBe(2640);
  });

  it("soft-excludes lines from totals while retaining them", () => {
    const result = resolveQuote(engine, {
      overrides: [{ line_id: "prim-lawn", excluded: true }],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    const lawn = result.lines.find((l) => l.id === "prim-lawn")!;
    expect(lawn.excluded).toBe(true);
    expect(result.taxableExGst).toBe(3200);
  });

  it("applies global margin before GST", () => {
    const result = resolveQuote(engine, {
      overrides: [],
      custom_lines: [],
      margin: { global_pct: 10, by_section: {} },
    });
    expect(result.taxableExGst).toBe(4510);
    expect(result.marginAmount).toBe(410);
    expect(result.gst).toBe(451);
    expect(result.totalInclGst).toBe(4961);
  });

  it("surfaces orphaned overrides after re-estimate", () => {
    const result = resolveQuote(engine, {
      overrides: [
        { line_id: "prim-pave", qty: 8 },
        { line_id: "gone-line", qty: 1 },
      ],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    expect(result.orphanOverrides).toHaveLength(1);
    expect(result.orphanOverrides[0]!.line_id).toBe("gone-line");
  });

  it("keeps unselected alternates out of the total", () => {
    const result = resolveQuote(engine, {
      overrides: [
        {
          line_id: "prim-lawn",
          alternate_of: "prim-pave",
          alternate_selected: false,
        },
      ],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    expect(result.taxableExGst).toBe(3200);
  });

  it("maps studio estimate lines through the adapter", () => {
    const lines: StudioEstimateLine[] = [
      {
        id: "prim-1",
        tier: "primary",
        label: "Canopy tree",
        unit: "ea",
        qty: 2,
        rate: 650,
        total: 1300,
        sourceIds: ["a"],
      },
    ];
    const adapted = engineLinesFromStudioEstimate(lines);
    expect(adapted[0]!.sectionHint).toBe("planting");
    expect(sectionForEstimateTier("primary", "French drain")).toBe("drainage");
  });

  it("freezes share lines from resolved totals", () => {
    const result = resolveQuote(engine, {
      overrides: [],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
    });
    const share = quoteDocToShareLines(result, 18);
    expect(share).toHaveLength(2);
    expect(share[0]!.total).toBe(3200);
  });
});

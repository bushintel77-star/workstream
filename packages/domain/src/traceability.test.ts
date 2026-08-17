import { describe, expect, it } from "vitest";
import { estimateStudioDrawing } from "./studio-preemptive-estimate";
import {
  assertQuoteTraceability,
  assertTraceability,
  quoteTraceabilityViolations,
  traceabilityViolations,
} from "./traceability";

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

/** A real engine output with hardscape + lawn + trees placed. */
function realReport() {
  return estimateStudioDrawing({
    outdoorM2: 230,
    boundary,
    items: [
      { id: "p1", t: "paving", x: 50, y: 50, scale: 1.2, areaKind: "rect", wPx: 110, hPx: 80 },
      { id: "lawn1", t: "lawn", x: 50, y: 60, scale: 1.5, areaKind: "rect", wPx: 130, hPx: 95 },
      { id: "tree1", t: "canopy", x: 30, y: 30, scale: 1 },
    ],
  });
}

describe("traceability gate — real engine outputs", () => {
  it("passes a populated BOM (every line traces to placed items)", () => {
    const report = realReport();
    expect(report.lines.length).toBeGreaterThan(0);
    expect(() => assertTraceability(report)).not.toThrow();
    expect(traceabilityViolations(report)).toEqual([]);
  });

  it("passes an empty canvas (no figures, nothing to label)", () => {
    const report = estimateStudioDrawing({ outdoorM2: 0, boundary, items: [] });
    expect(() => assertTraceability(report)).not.toThrow();
  });

  it("passes when the trace strip labels an open boundary as indicative", () => {
    const report = {
      lines: realReport().lines,
      trace: [
        {
          label: "Site area (boundary ring)",
          unit: "m²" as const,
          qty: 0,
          source: "indicative" as const,
          sourceIds: [],
          note: "Boundary not closed — indicative until the ring closes",
        },
      ],
    };
    expect(() => assertTraceability(report)).not.toThrow();
  });
});

describe("traceability gate — crafted violations", () => {
  it("fails an unlabelled BOM line (no source ids)", () => {
    const report = {
      lines: [
        {
          id: "x",
          tier: "primary" as const,
          label: "Bluestone paving",
          unit: "m²",
          qty: 40,
          rate: 320,
          total: 12800,
          sourceIds: [],
        },
      ],
    };
    const v = traceabilityViolations(report);
    expect(v.some((x) => x.kind === "unlabelled" && x.figure === "Bluestone paving")).toBe(
      true,
    );
    expect(() => assertTraceability(report)).toThrow(/Traceability violations/);
  });

  it("fails a trace figure with no source label at all", () => {
    const report = {
      lines: [],
      trace: [
        {
          label: "Site area",
          unit: "m²" as const,
          qty: 512,
          source: null as unknown as "boundary",
          sourceIds: [],
          note: "",
        },
      ],
    };
    expect(traceabilityViolations(report).some((x) => x.kind === "unlabelled")).toBe(true);
  });

  it("fails a boundary figure that claims the ring but has no area", () => {
    const report = {
      lines: [],
      trace: [
        {
          label: "Site area (boundary ring)",
          unit: "m²" as const,
          qty: 0,
          source: "boundary" as const,
          sourceIds: [],
          note: "",
        },
      ],
    };
    expect(
      traceabilityViolations(report).some((x) => x.kind === "unsubstantiated"),
    ).toBe(true);
  });

  it("fails an item-count figure with no source ids", () => {
    const report = {
      lines: [],
      trace: [
        {
          label: "Trees",
          unit: "ea" as const,
          qty: 3,
          source: "item" as const,
          sourceIds: [],
          note: "",
        },
      ],
    };
    expect(
      traceabilityViolations(report).some((x) => x.kind === "empty_source_ids"),
    ).toBe(true);
  });

  it("fails a cad_qty figure with no source ids", () => {
    const report = {
      lines: [],
      trace: [
        {
          label: "Hardscape area",
          unit: "m²" as const,
          qty: 42,
          source: "cad_qty" as const,
          sourceIds: [],
          note: "",
        },
      ],
    };
    expect(
      traceabilityViolations(report).some((x) => x.kind === "empty_source_ids"),
    ).toBe(true);
  });
});

describe("quote traceability gate", () => {
  it("passes quote lines that match sourced BOM lines", () => {
    const bom = realReport();
    const quote = bom.lines
      .filter((l) => l.sourceIds.length > 0)
      .slice(0, 3)
      .map((l) => ({ id: l.id, label: l.label, unit: l.unit, qty: l.qty }));
    expect(() => assertQuoteTraceability(quote, bom.lines)).not.toThrow();
  });

  it("fails a quote line with no matching sourced BOM line", () => {
    const bom = realReport();
    const quote = [{ id: "q1", label: "Mystery charge", unit: "ea", qty: 1 }];
    const v = quoteTraceabilityViolations(quote, bom.lines);
    expect(v.some((x) => x.kind === "unlabelled" && /Mystery charge/.test(x.figure))).toBe(
      true,
    );
    expect(() => assertQuoteTraceability(quote, bom.lines)).toThrow(
      /does not match a sourced BOM line/,
    );
  });
});

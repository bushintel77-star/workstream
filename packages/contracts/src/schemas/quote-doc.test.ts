import { describe, expect, it } from "vitest";
import {
  QuoteDocSchema,
  QuoteOverrideSchema,
  QuoteSectionIdSchema,
} from "./quote-doc";

describe("QuoteDocSchema", () => {
  it("parses a minimal quote doc", () => {
    const doc = QuoteDocSchema.parse({
      project_id: "11111111-1111-4111-8111-111111111111",
      overrides: [],
      custom_lines: [],
      margin: { global_pct: 0, by_section: {} },
      updated_at: "2026-07-27T00:00:00.000Z",
    });
    expect(doc.overrides).toEqual([]);
    expect(doc.margin.global_pct).toBe(0);
  });

  it("accepts line_id overrides with optional sku", () => {
    const ov = QuoteOverrideSchema.parse({
      line_id: "prim-abc",
      sku: "PAV-BLUE-SAWN",
      qty: 12,
      excluded: false,
    });
    expect(ov.line_id).toBe("prim-abc");
    expect(ov.sku).toBe("PAV-BLUE-SAWN");
  });

  it("enumerates quote sections", () => {
    expect(QuoteSectionIdSchema.options).toContain("planting");
    expect(QuoteSectionIdSchema.options).toContain("custom");
  });
});

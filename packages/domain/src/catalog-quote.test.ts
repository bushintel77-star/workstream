import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { formatSitePlanQuoteSection } from "./catalog-quote";

describe("formatSitePlanQuoteSection", () => {
  it("returns empty when no placements", () => {
    expect(formatSitePlanQuoteSection(null)).toEqual([]);
  });

  it("formats placement table with SKU", () => {
    const canvas: DesignCanvas = {
      id: "c1",
      project_id: "p1",
      placements: [
        {
          id: "a",
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 20,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: "b",
          symbol_id: "hornbeam-pleached",
          x_pct: 30,
          y_pct: 40,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: [],
      irrigation_zones: [],
      construction_trenches: [],
      annotations: [],
      image_layers: [],
      features: [],
      updated_at: new Date().toISOString(),
    };
    const lines = formatSitePlanQuoteSection(canvas);
    expect(lines.some((l) => l.includes("Site plan"))).toBe(true);
    expect(lines.some((l) => l.includes("Pleached hornbeam"))).toBe(true);
    expect(lines.some((l) => l.includes("| 2 |"))).toBe(true);
    expect(lines.some((l) => l.includes("PLT-HORN"))).toBe(true);
  });
});

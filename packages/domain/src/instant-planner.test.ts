import { describe, expect, it } from "vitest";
import type { BomLine } from "@workstream/contracts";
import { formatLabourChip, summarizeLabourHours } from "./instant-planner";

function line(partial: Partial<BomLine> & Pick<BomLine, "id" | "tier" | "qty" | "unit">): BomLine {
  return {
    sku: null,
    label: "x",
    rate: 0,
    total: 0,
    source_object_ids: [],
    is_provisional: true,
    ...partial,
  };
}

describe("instant-planner", () => {
  it("sums hr labour and ea plant heuristic", () => {
    const hours = summarizeLabourHours([
      line({ id: "1", tier: "labour", qty: 10, unit: "hr" }),
      line({ id: "2", tier: "labour", qty: 4, unit: "ea" }),
      line({ id: "3", tier: "primary", qty: 99, unit: "hr" }),
    ]);
    expect(hours).toBe(12);
  });

  it("formats labour chip", () => {
    expect(formatLabourChip(0)).toBe("—");
    expect(formatLabourChip(0.4)).toBe("~0.5 h");
    expect(formatLabourChip(12.2)).toBe("~12 h");
  });
});

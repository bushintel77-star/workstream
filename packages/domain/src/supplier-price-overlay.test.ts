import { describe, expect, it } from "vitest";
import type { LineItem, RateCard } from "@workstream/contracts";
import {
  overlayQuoteLinesWithSupplierPrices,
  overlayRateCardWithSupplierPrices,
} from "./supplier-price-overlay";

function rateCard(sku: string, rate: number): RateCard {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    owner_id: "owner",
    category: "materials",
    sku,
    label: sku,
    unit: "ea",
    rate,
    effective_from: new Date().toISOString(),
  };
}

function lineItem(sku: string, qty: number, rate: number): LineItem {
  return {
    sku,
    label: sku,
    unit: "ea",
    qty,
    rate,
    total: qty * rate,
    is_provisional: false,
  };
}

describe("overlayRateCardWithSupplierPrices", () => {
  it("leaves rates untouched with no overlay", () => {
    const rates = [rateCard("BUN-CEM-20", 9.5)];
    const result = overlayRateCardWithSupplierPrices(rates, []);
    expect(result.applied).toBe(0);
    expect(result.rates[0]!.rate).toBe(9.5);
    expect(result.honesty).toMatch(/rate card only/i);
  });

  it("replaces only exact SKU matches", () => {
    const rates = [rateCard("BUN-CEM-20", 9.5), rateCard("BUN-SAND-20", 7.95)];
    const result = overlayRateCardWithSupplierPrices(rates, [
      { sku: "BUN-CEM-20", rate: 8.75, supplier_label: "Bunnings Trade" },
    ]);
    expect(result.applied).toBe(1);
    expect(result.rates.find((r) => r.sku === "BUN-CEM-20")!.rate).toBe(8.75);
    expect(result.rates.find((r) => r.sku === "BUN-SAND-20")!.rate).toBe(7.95);
    expect(result.honesty).toMatch(/applied/i);
  });

  it("does not invent rows for unmatched overlay SKUs", () => {
    const rates = [rateCard("BUN-CEM-20", 9.5)];
    const result = overlayRateCardWithSupplierPrices(rates, [
      { sku: "NOT-IN-RATE-CARD", rate: 100, supplier_label: "Boral" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.rates).toHaveLength(1);
  });
});

describe("overlayQuoteLinesWithSupplierPrices", () => {
  it("recomputes line total when rate is overlaid", () => {
    const lines = [lineItem("ANL-BLUE-SAWN", 10, 118)];
    const result = overlayQuoteLinesWithSupplierPrices(lines, [
      { sku: "ANL-BLUE-SAWN", rate: 100, supplier_label: "ANL" },
    ]);
    expect(result.applied).toBe(1);
    expect(result.lines[0]!.rate).toBe(100);
    expect(result.lines[0]!.total).toBe(1000);
  });

  it("passes through lines with no matching overlay", () => {
    const lines = [lineItem("ANL-BLUE-SAWN", 10, 118)];
    const result = overlayQuoteLinesWithSupplierPrices(lines, [
      { sku: "OTHER-SKU", rate: 1, supplier_label: "x" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.lines[0]!.rate).toBe(118);
    expect(result.lines[0]!.total).toBe(1180);
  });
});

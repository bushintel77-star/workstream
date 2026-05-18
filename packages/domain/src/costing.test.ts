import { describe, expect, it } from "vitest";
import {
  applyContingency,
  calculateGST,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
  CONTINGENCY_RATES,
} from "./costing";

describe("calculateLineTotal", () => {
  it("multiplies qty by rate and rounds to cents", () => {
    expect(calculateLineTotal(24, 120.50)).toBe(2892);
    expect(calculateLineTotal(38, 120)).toBe(4560);
    expect(calculateLineTotal(36, 11)).toBe(396);
  });

  it("handles fractional quantities", () => {
    expect(calculateLineTotal(2.5, 100)).toBe(250);
    expect(calculateLineTotal(0.1, 0.1)).toBe(0.01);
  });
});

describe("calculateSubtotal", () => {
  it("sums an array of line totals", () => {
    expect(calculateSubtotal([100, 200, 300])).toBe(600);
    expect(calculateSubtotal([])).toBe(0);
    expect(calculateSubtotal([12.34, 56.78])).toBeCloseTo(69.12);
  });
});

describe("calculateGST", () => {
  it("is 10% of subtotal", () => {
    expect(calculateGST(100)).toBe(10);
    expect(calculateGST(2500)).toBe(250);
    expect(calculateGST(0)).toBe(0);
  });
});

describe("calculateTotal", () => {
  it("is subtotal + gst", () => {
    expect(calculateTotal(1000, 100)).toBe(1100);
    expect(calculateTotal(0, 0)).toBe(0);
  });
});

describe("applyContingency", () => {
  it("returns the configured percentage of subtotal", () => {
    expect(applyContingency(10000, "lean")).toBe(300);
    expect(applyContingency(10000, "standard")).toBe(500);
    expect(applyContingency(10000, "buffer")).toBe(800);
  });

  it("rates table matches spec §B.13", () => {
    expect(CONTINGENCY_RATES.lean).toBe(0.03);
    expect(CONTINGENCY_RATES.standard).toBe(0.05);
    expect(CONTINGENCY_RATES.buffer).toBe(0.08);
  });
});

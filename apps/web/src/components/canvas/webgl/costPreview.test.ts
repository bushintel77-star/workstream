import { describe, it, expect } from "vitest";
import {
  estimatedCostPerUnit,
  estimatedCostTotal,
  formatCostPreview,
} from "./costPreview";

describe("costPreview", () => {
  describe("estimatedCostPerUnit", () => {
    it("returns positive cost for canopy tree", () => {
      const cost = estimatedCostPerUnit("hornbeam-pleached");
      expect(cost).toBeGreaterThan(0);
    });

    it("returns positive cost for paving", () => {
      const cost = estimatedCostPerUnit("bluestone-paver");
      expect(cost).toBeGreaterThan(0);
    });

    it("returns 0 for existing trees (no cost)", () => {
      const cost = estimatedCostPerUnit("existing-tree-retain");
      expect(cost).toBe(0);
    });

    it("returns 0 for unknown symbol", () => {
      const cost = estimatedCostPerUnit("nonexistent-symbol-xyz");
      expect(cost).toBe(0);
    });

    it("returns different costs for different types", () => {
      const tree = estimatedCostPerUnit("hornbeam-pleached");
      const paver = estimatedCostPerUnit("bluestone-paver");
      expect(tree).not.toBe(paver);
    });
  });

  describe("estimatedCostTotal", () => {
    it("multiplies per-unit cost by count", () => {
      const perUnit = estimatedCostPerUnit("hornbeam-pleached");
      expect(estimatedCostTotal("hornbeam-pleached", 3)).toBe(
        Math.round(perUnit * 3),
      );
    });

    it("returns 0 for count 0", () => {
      expect(estimatedCostTotal("hornbeam-pleached", 0)).toBe(0);
    });
  });

  describe("formatCostPreview", () => {
    it("returns empty string for 0", () => {
      expect(formatCostPreview(0)).toBe("");
    });

    it("formats amounts under $1,000 without decimals", () => {
      expect(formatCostPreview(875)).toBe("$875");
      expect(formatCostPreview(42)).toBe("$42");
    });

    it("formats amounts ≥ $1,000 with k suffix", () => {
      expect(formatCostPreview(1425)).toBe("$1.4k");
      expect(formatCostPreview(58410)).toBe("$58.4k");
    });
  });
});

import { describe, expect, it } from "vitest";
import { coefficientFor, totalEmbodiedCarbon } from "./carbon";

describe("coefficientFor", () => {
  it("returns null for unknown SKUs", () => {
    expect(coefficientFor("DOES-NOT-EXIST")).toBeNull();
  });

  it("returns a positive value for emitting materials", () => {
    const bluestone = coefficientFor("PAV-BLUE-SAWN");
    expect(bluestone).not.toBeNull();
    expect(bluestone!.kg_co2e_per_unit).toBeGreaterThan(0);
    expect(bluestone!.unit).toBe("m2");
  });

  it("returns negative values for sequestering materials", () => {
    const compost = coefficientFor("SOIL-COMP");
    expect(compost!.kg_co2e_per_unit).toBeLessThan(0);

    const mulch = coefficientFor("MULCH-PINE");
    expect(mulch!.kg_co2e_per_unit).toBeLessThan(0);
  });
});

describe("totalEmbodiedCarbon", () => {
  it("nets emitting and sequestering across a line-item list", () => {
    const result = totalEmbodiedCarbon([
      { sku: "PAV-BLUE-SAWN", qty: 36 }, // 36 × 22 = 792
      { sku: "MULCH-PINE", qty: 4 },     // 4  × -22 = -88
      { sku: "SOIL-COMP", qty: 2 },      // 2  × -45 = -90
    ]);
    expect(result.emitting_kg_co2e).toBeCloseTo(792, 0);
    expect(result.sequestering_kg_co2e).toBeCloseTo(-178, 0);
    expect(result.net_kg_co2e).toBeCloseTo(614, 0);
  });

  it("collects unknown SKUs separately without throwing", () => {
    const result = totalEmbodiedCarbon([
      { sku: "PAV-BLUE-SAWN", qty: 10 },
      { sku: "MYSTERY-SKU", qty: 5 },
    ]);
    expect(result.per_sku).toHaveLength(1);
    expect(result.unknown_skus).toEqual(["MYSTERY-SKU"]);
  });

  it("returns zeros for empty input", () => {
    const result = totalEmbodiedCarbon([]);
    expect(result.net_kg_co2e).toBe(0);
    expect(result.emitting_kg_co2e).toBe(0);
    expect(result.sequestering_kg_co2e).toBe(0);
    expect(result.per_sku).toHaveLength(0);
    expect(result.unknown_skus).toHaveLength(0);
  });
});

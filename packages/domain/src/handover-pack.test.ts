import { describe, expect, it } from "vitest";
import { buildHandoverPack } from "./handover-pack";

describe("buildHandoverPack", () => {
  it("assembles plant entries with care notes", () => {
    const pack = buildHandoverPack({
      plantings: [
        { species: "Quercus robur", common_name: "English oak", count: 2, form: "200L bag" },
        { species: "Lomandra longifolia", common_name: "Mat rush", count: 20, form: "140mm pot" },
      ],
      irrigation: [],
      lighting: [],
      materials: [],
    });
    expect(pack.plants).toHaveLength(2);
    expect(pack.plants[0]!.species).toBe("Quercus robur");
    expect(pack.plants[0]!.care_notes).toContain("Stake");
    expect(pack.plants[1]!.care_notes).toContain("mulch");
  });

  it("includes existing trees in handover pack", () => {
    const pack = buildHandoverPack({
      plantings: [
        { species: "Eucalyptus camaldulensis", common_name: "River red gum", count: 1, form: "existing retained" },
      ],
      irrigation: [],
      lighting: [],
      materials: [],
    });
    expect(pack.plants).toHaveLength(1);
    expect(pack.plants[0]!.category).toBe("exist");
    expect(pack.plants[0]!.watering).toContain("established");
  });

  it("passes through irrigation items", () => {
    const pack = buildHandoverPack({
      plantings: [],
      irrigation: [
        { item: "Drip line 16mm", qty: 50, unit: "m", sku: "DRIP-16" },
      ],
      lighting: [],
      materials: [],
    });
    expect(pack.irrigation).toHaveLength(1);
    expect(pack.irrigation[0]!.item).toBe("Drip line 16mm");
    expect(pack.irrigation[0]!.sku).toBe("DRIP-16");
  });

  it("passes through lighting fixtures", () => {
    const pack = buildHandoverPack({
      plantings: [],
      irrigation: [],
      lighting: [
        { fixture: "Garden spike light", count: 6, sku: "SL-01" },
      ],
      materials: [],
    });
    expect(pack.lighting).toHaveLength(1);
    expect(pack.lighting[0]!.fixture).toBe("Garden spike light");
    expect(pack.lighting[0]!.count).toBe(6);
  });

  it("passes through materials with supplier", () => {
    const pack = buildHandoverPack({
      plantings: [],
      irrigation: [],
      lighting: [],
      materials: [
        { item: "Bluestone pavers", sku: "BS-300", supplier: "Stone Warehouse" },
      ],
    });
    expect(pack.materials).toHaveLength(1);
    expect(pack.materials[0]!.supplier).toBe("Stone Warehouse");
  });

  it("provides default warranty periods", () => {
    const pack = buildHandoverPack({
      plantings: [],
      irrigation: [],
      lighting: [],
      materials: [],
    });
    expect(pack.warranty_periods.length).toBeGreaterThan(0);
    const items = pack.warranty_periods.map((w) => w.item);
    expect(items).toContain("Hardscape construction (paving, decking, walls)");
    expect(items).toContain("Plant material");
  });

  it("handles empty input gracefully", () => {
    const pack = buildHandoverPack({
      plantings: [],
      irrigation: [],
      lighting: [],
      materials: [],
    });
    expect(pack.plants).toHaveLength(0);
    expect(pack.irrigation).toHaveLength(0);
    expect(pack.lighting).toHaveLength(0);
    expect(pack.materials).toHaveLength(0);
    expect(pack.warranty_periods.length).toBeGreaterThan(0);
  });
});

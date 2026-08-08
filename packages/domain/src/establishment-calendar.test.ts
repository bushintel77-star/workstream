import { describe, expect, it } from "vitest";
import { buildEstablishmentCalendar } from "./establishment-calendar";

describe("buildEstablishmentCalendar", () => {
  it("classifies canopy trees by form (200L bag)", () => {
    const result = buildEstablishmentCalendar([
      { species: "Quercus robur", common_name: "English oak", count: 2, form: "200L bag" },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.category).toBe("canopy");
    expect(result.entries[0]!.summer1_watering_per_week).toBe(2);
    expect(result.entries[0]!.establishment_weeks).toBe(104);
  });

  it("classifies hedges by species (Lomandra)", () => {
    const result = buildEstablishmentCalendar([
      { species: "Lomandra longifolia", common_name: "Mat rush", count: 20, form: "140mm pot" },
    ]);
    expect(result.entries[0]!.category).toBe("hedge");
    expect(result.entries[0]!.summer1_watering_per_week).toBe(3);
  });

  it("classifies bed/groundcover by default", () => {
    const result = buildEstablishmentCalendar([
      { species: "Miscanthus sinensis", common_name: "Zebragrass", count: 5, form: "1L pot" },
    ]);
    expect(result.entries[0]!.category).toBe("bed");
    expect(result.entries[0]!.summer1_watering_per_week).toBe(2);
  });

  it("classifies feature plants by form (25L pot)", () => {
    const result = buildEstablishmentCalendar([
      { species: "Carpinus betulus", common_name: "Pleached hornbeam", count: 4, form: "25L pot pleached" },
    ]);
    expect(result.entries[0]!.category).toBe("feature");
    expect(result.entries[0]!.summer1_watering_per_week).toBe(1);
  });

  it("skips existing trees by default", () => {
    const result = buildEstablishmentCalendar([
      { species: "Eucalyptus camaldulensis", common_name: "River red gum", count: 1, form: "existing retained" },
    ]);
    expect(result.entries).toHaveLength(0);
  });

  it("includes existing trees when flag set", () => {
    const result = buildEstablishmentCalendar(
      [{ species: "Eucalyptus camaldulensis", common_name: "River red gum", count: 1, form: "existing retained" }],
      { includeExisting: true },
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.category).toBe("exist");
    expect(result.entries[0]!.summer1_watering_per_week).toBe(0);
  });

  it("generates species code from botanical name", () => {
    const result = buildEstablishmentCalendar([
      { species: "Quercus robur", common_name: "English oak", count: 1, form: "200L bag" },
    ]);
    expect(result.entries[0]!.species_code).toBe("QR");
  });

  it("provides general guidance text", () => {
    const result = buildEstablishmentCalendar([]);
    expect(result.guidance).toContain("mulch");
    expect(result.guidance).toContain("deep");
  });

  it("handles empty planting list", () => {
    const result = buildEstablishmentCalendar([]);
    expect(result.entries).toHaveLength(0);
    expect(result.guidance).toBeTruthy();
  });

  it("handles multiple plantings of different categories", () => {
    const result = buildEstablishmentCalendar([
      { species: "Quercus robur", common_name: "English oak", count: 2, form: "200L bag" },
      { species: "Lomandra longifolia", common_name: "Mat rush", count: 20, form: "140mm pot" },
      { species: "Salvia nemorosa", common_name: "Meadow sage", count: 15, form: "tube" },
    ]);
    expect(result.entries).toHaveLength(3);
    const categories = result.entries.map((e) => e.category);
    expect(categories).toContain("canopy");
    expect(categories).toContain("hedge");
    expect(categories).toContain("bed");
  });
});

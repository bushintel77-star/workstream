import { describe, expect, it } from "vitest";
import { buildSketchLineItems, sketchQtyForSymbol } from "./sketch-costing";
import type { CatalogSymbol, RateCard } from "@workstream/contracts";

const hornbeam: CatalogSymbol = {
  id: "hornbeam-pleached",
  label: "Pleached hornbeam",
  category: "planting",
  path_d: "M4 20V8",
  rate_card_sku: "PLT-HORN",
  default_width_m: 4,
};

describe("sketch costing", () => {
  it("uses pin count for planting", () => {
    expect(sketchQtyForSymbol(hornbeam, 3, { garden_area_m2: 200 })).toBe(3);
  });

  it("builds provisional line items from placements", () => {
    const rates = new Map<string, RateCard>([
      [
        "PLT-HORN",
        {
          id: "1",
          owner_id: "o",
          category: "planting",
          sku: "PLT-HORN",
          label: "Hornbeam",
          unit: "ea",
          rate: 400,
          effective_from: new Date().toISOString(),
        },
      ],
    ]);
    const lines = buildSketchLineItems(
      [
        {
          id: "a",
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: "b",
          symbol_id: "hornbeam-pleached",
          x_pct: 20,
          y_pct: 20,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      [hornbeam],
      { garden_area_m2: 300 },
      rates,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
    expect(lines[0].is_provisional).toBe(true);
  });
});

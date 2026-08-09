import { describe, expect, it } from "vitest";
import {
  buildLightingSchedule,
  buildMaterialSchedule,
  buildPlantingSchedule,
  buildSupplierOrderSheet,
  buildTrenchSchedule,
  plantingScheduleCsv,
  supplierOrderSheetMarkdown,
} from "./ops-schedules";

describe("ops schedules", () => {
  it("builds planting schedule from palette placements", () => {
    const sched = buildPlantingSchedule({
      placements: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          symbol_id: "hornbeam-pleached",
          x_pct: 20,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          symbol_id: "lomandra-mass",
          x_pct: 30,
          y_pct: 30,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    expect(sched.rows.find((r) => r.symbol_id === "hornbeam-pleached")?.count).toBe(
      2,
    );
    expect(plantingScheduleCsv(sched)).toContain("Pleached");
  });

  it("builds trench dig schedule excluding ghosts", () => {
    const sched = buildTrenchSchedule(
      {
        construction_trenches: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "Main",
            kind: "irrig_main",
            points: [
              { x_pct: 0, y_pct: 0 },
              { x_pct: 50, y_pct: 0 },
            ],
            depth_mm: 400,
            source: "auto",
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            name: "Ghost",
            kind: "drainage",
            points: [
              { x_pct: 0, y_pct: 10 },
              { x_pct: 10, y_pct: 10 },
            ],
            depth_mm: 450,
            source: "auto",
            ghost: true,
          },
        ],
      },
    );

    expect(sched.rows).toHaveLength(1);
    expect(sched.rows[0]!.length_m).toBeGreaterThan(0);
  });

  it("builds lighting VA schedule", () => {
    const sched = buildLightingSchedule({
      placements: [
        {
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          symbol_id: "brass-uplight",
          x_pct: 40,
          y_pct: 40,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      irrigation_zones: [],
      construction_trenches: [],
    });
    expect(sched.rows[0]?.count).toBe(1);
    expect(sched.aggregate_design_va).toBeGreaterThan(0);
  });

  it("builds material schedule from quote lines", () => {
    const sched = buildMaterialSchedule({
      lineItems: [
        {
          sku: "PLT-HORN",
          label: "Pleached hornbeam",
          unit: "ea",
          qty: 4,
          rate: 120,
          total: 480,
        },
      ],
    });
    expect(sched.rows[0]?.sku).toBe("PLT-HORN");
    expect(sched.rows[0]?.supplier).toBeNull();
  });

  it("groups supplier order sheet by rate-card supplier", () => {
    const sheet = buildSupplierOrderSheet({
      lineItems: [
        {
          sku: "PLT-HORN",
          label: "Pleached hornbeam",
          unit: "ea",
          qty: 4,
          rate: 120,
          total: 480,
        },
        {
          sku: "PAV-BLUE",
          label: "Bluestone paving",
          unit: "m2",
          qty: 12,
          rate: 180,
          total: 2160,
        },
      ],
      rateCard: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          owner_id: "dev-user",
          category: "planting",
          sku: "PLT-HORN",
          label: "Pleached hornbeam",
          unit: "ea",
          rate: 120,
          supplier: "Speciality Trees",
          effective_from: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(sheet.line_count).toBe(2);
    expect(sheet.groups[0]?.supplier).toBe("Speciality Trees");
    expect(sheet.unassigned[0]?.sku).toBe("PAV-BLUE");
    const md = supplierOrderSheetMarkdown(sheet, {
      address: "12 Test St, Melbourne VIC 3000",
      generatedOn: "2026-08-09",
    });
    expect(md).toContain("Supplier order / delivery request");
    expect(md).toContain("Speciality Trees");
    expect(md).toContain("Supplier TBA");
    expect(md).toContain("Not a fake brochure");
  });
});

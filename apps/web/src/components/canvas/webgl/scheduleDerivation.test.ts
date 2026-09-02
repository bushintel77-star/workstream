import { describe, expect, it } from "vitest";
import { deriveScheduleSheet } from "./scheduleDerivation";

const placement = (
  id: string,
  symbolId: string,
  x = 50,
  y = 50,
) => ({
  id,
  symbol_id: symbolId,
  label: symbolId,
  x_pct: x,
  y_pct: y,
  rotation_deg: 0,
  scale: 1,
});

describe("deriveScheduleSheet — derived schedule rows", () => {
  it("groups planting placements by symbol into qty rows", () => {
    const sheet = deriveScheduleSheet({
      placements: [
        placement("a", "hornbeam-pleached", 20, 20),
        placement("b", "hornbeam-pleached", 40, 40),
        placement("c", "lawn-turf", 60, 60),
      ],
      trenches: [],
      irrigationZones: [],
      scaleM: 110,
    });
    const hornbeam = sheet.planting.rows.find((r) => r.qty === 2);
    expect(hornbeam).toBeDefined();
    expect(hornbeam!.pot).toBeTruthy();
    expect(sheet.planting.rows.length).toBe(2);
    expect(sheet.totals.softscapeCount).toBe(3);
    expect(sheet.totals.objectCount).toBe(3);
    expect(sheet.planting.honesty).toMatch(/Indicative planting schedule/);
  });

  it("groups paving placements into hardscape rows with real dimensions", () => {
    const sheet = deriveScheduleSheet({
      placements: [
        placement("a", "bluestone-paver", 20, 20),
        placement("b", "bluestone-paver", 30, 30),
      ],
      trenches: [],
      irrigationZones: [],
      scaleM: 110,
    });
    expect(sheet.hardscape.rows.length).toBe(1);
    expect(sheet.hardscape.rows[0]!.qty).toBe(2);
    expect(sheet.hardscape.rows[0]!.code).toMatch(/BLUESTONE/);
    expect(sheet.totals.hardscapeCount).toBe(2);
    // Planting must not double-count paving.
    expect(sheet.planting.rows.length).toBe(0);
  });

  it("derives trench rows from accepted trenches with the honesty footer", () => {
    const sheet = deriveScheduleSheet({
      placements: [],
      trenches: [
        {
          id: "t1",
          name: "Drainage run",
          kind: "drainage",
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 10, y_pct: 0 },
          ],
          depth_mm: 450,
          source: "traced",
        },
      ],
      irrigationZones: [],
      scaleM: 110,
    });
    expect(sheet.services.trenches.length).toBe(1);
    expect(sheet.services.trenches[0]!.depthBand).toBe("400–500 mm");
    expect(sheet.services.trenches[0]!.lengthM).toBeGreaterThan(0);
    expect(sheet.services.honesty).toMatch(/not BYDA/);
  });

  it("flags an overloaded transformer as the one red number", () => {
    // Enough fixtures to push the aggregate design load over the 80% rule.
    const fixtures = Array.from({ length: 200 }, (_, i) =>
      placement(`light-${i}`, "brass-uplight", 10 + (i % 80), 10 + (i % 80)),
    );
    const sheet = deriveScheduleSheet({
      placements: fixtures,
      trenches: [],
      irrigationZones: [],
      scaleM: 110,
    });
    expect(sheet.services.transformer).not.toBeNull();
    expect(sheet.services.transformer!.overloaded).toBe(true);
    expect(sheet.services.transformer!.designVa).toBeGreaterThan(0);
  });

  it("derives nothing when the board is empty (honest empty, no invented rows)", () => {
    const sheet = deriveScheduleSheet({
      placements: [],
      trenches: [],
      irrigationZones: [],
      scaleM: 110,
    });
    expect(sheet.planting.rows.length).toBe(0);
    expect(sheet.hardscape.rows.length).toBe(0);
    expect(sheet.services.trenches.length).toBe(0);
    expect(sheet.services.lighting.length).toBe(0);
    expect(sheet.totals.softscapeCount).toBe(0);
  });
});

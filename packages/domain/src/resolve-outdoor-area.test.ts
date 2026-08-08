import { describe, expect, it } from "vitest";
import {
  deductibleOutdoorM2,
  isSeedSurveyLot,
  polygonAreaFromBoardPercent,
  resolveOutdoorAreaM2,
} from "./resolve-outdoor-area";

describe("isSeedSurveyLot", () => {
  it("detects the legacy 15×40 mock", () => {
    expect(
      isSeedSurveyLot({
        lot_area_m2: 600,
        measurements: [
          { edge_id: "front" },
          { edge_id: "east" },
          { edge_id: "back" },
          { edge_id: "west" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects Vicmap-style edge ids", () => {
    expect(
      isSeedSurveyLot({
        lot_area_m2: 600,
        measurements: [{ edge_id: "edge_1" }, { edge_id: "edge_2" }],
      }),
    ).toBe(false);
  });
});

describe("polygonAreaFromBoardPercent", () => {
  it("shoelace a full-board square at 100 m scale", () => {
    const area = polygonAreaFromBoardPercent(
      [
        { x_pct: 0, y_pct: 0 },
        { x_pct: 100, y_pct: 0 },
        { x_pct: 100, y_pct: 100 },
        { x_pct: 0, y_pct: 100 },
      ],
      100,
    );
    expect(area).toBeCloseTo(10_000, 6);
  });
});

describe("deductibleOutdoorM2", () => {
  it("subtracts the housing envelope from the lot", () => {
    expect(deductibleOutdoorM2(500, 200)).toBe(300);
  });

  it("returns the lot when no envelope is known", () => {
    expect(deductibleOutdoorM2(500, null)).toBe(500);
    expect(deductibleOutdoorM2(500, 0)).toBe(500);
  });
});

describe("resolveOutdoorAreaM2", () => {
  it("prefers garden over lot (garden is already deductible)", () => {
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 300,
      lot_area_m2: 500,
      house_area_m2: 200,
    });
    expect(r.outdoor_m2).toBe(300);
    expect(r.lot_m2).toBe(500);
    expect(r.house_m2).toBe(200);
    expect(r.outdoor_provenance).toBe("vicmap");
  });

  it("deducts the housing envelope when garden is absent", () => {
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 0,
      lot_area_m2: 500,
      house_area_m2: 180,
    });
    expect(r.outdoor_m2).toBe(320);
    expect(r.house_m2).toBe(180);
    expect(r.outdoor_provenance).toBe("derived");
  });

  it("never invents a figure when nothing is known", () => {
    const r = resolveOutdoorAreaM2({});
    expect(r.outdoor_m2).toBeNull();
    expect(r.lot_m2).toBeNull();
    expect(r.house_m2).toBeNull();
    expect(r.outdoor_provenance).toBe("absent");
    expect(r.lot_provenance).toBe("absent");
  });

  it("discards seed mock areas", () => {
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 600,
      lot_area_m2: 600,
      house_area_m2: 0,
      seedLot: true,
    });
    expect(r.outdoor_m2).toBeNull();
    expect(r.lot_m2).toBeNull();
  });

  it("falls back to operator-traced boundary minus dwelling", () => {
    const r = resolveOutdoorAreaM2({
      seedLot: true,
      garden_area_m2: 600,
      lot_area_m2: 600,
      boundary: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 90, y_pct: 10 },
        { x_pct: 90, y_pct: 90 },
        { x_pct: 10, y_pct: 90 },
      ],
      // Half the lot in plan — 40×20 = 800 m² envelope on a 50 m board.
      building: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 90, y_pct: 10 },
        { x_pct: 90, y_pct: 50 },
        { x_pct: 10, y_pct: 50 },
      ],
      scaleM: 50,
    });
    // Lot 1600 − house 800 = 800
    expect(r.lot_m2).toBeCloseTo(1600, 0);
    expect(r.house_m2).toBeCloseTo(800, 0);
    expect(r.outdoor_m2).toBeCloseTo(800, 0);
    expect(r.outdoor_provenance).toBe("derived");
  });

  it("uses title-ring shoelace when survey areas are zero", () => {
    const ring: [number, number][] = [
      [145.0, -37.85],
      [145.0002, -37.85],
      [145.0002, -37.85015],
      [145.0, -37.85015],
      [145.0, -37.85],
    ];
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 0,
      lot_area_m2: 0,
      titleRing: ring,
    });
    expect(r.outdoor_m2).toBeGreaterThan(100);
    expect(r.outdoor_provenance).toBe("vicmap");
  });

  it("deducts a Vicmap house ring from the title", () => {
    const title: [number, number][] = [
      [145.0, -37.85],
      [145.0002, -37.85],
      [145.0002, -37.85015],
      [145.0, -37.85015],
      [145.0, -37.85],
    ];
    // Smaller inner ring (~quarter of the title).
    const house: [number, number][] = [
      [145.00005, -37.85003],
      [145.00015, -37.85003],
      [145.00015, -37.85012],
      [145.00005, -37.85012],
      [145.00005, -37.85003],
    ];
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 0,
      lot_area_m2: 0,
      titleRing: title,
      houseRing: house,
    });
    expect(r.lot_m2).toBeGreaterThan(0);
    expect(r.house_m2).toBeGreaterThan(0);
    expect(r.outdoor_m2).toBe(deductibleOutdoorM2(r.lot_m2!, r.house_m2));
    expect(r.outdoor_m2!).toBeLessThan(r.lot_m2!);
    expect(r.outdoor_provenance).toBe("derived");
  });

  it("treats zero survey areas as absent", () => {
    const r = resolveOutdoorAreaM2({
      garden_area_m2: 0,
      lot_area_m2: 0,
    });
    expect(r.outdoor_m2).toBeNull();
  });
});

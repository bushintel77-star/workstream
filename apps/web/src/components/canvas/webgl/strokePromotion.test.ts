import { describe, expect, it } from "vitest";
import {
  strokeIsClosed,
  polygonAreaM2,
  polygonPerimeterM,
  buildPromotionCandidate,
  formatPromotionChip,
  promoteStrokeToObject,
  CLOSURE_THRESHOLD_PCT,
  MIN_AREA_M2,
  type StrokePoint,
  type PromotionPlane,
} from "./strokePromotion";

function makeClosedStroke(): StrokePoint[] {
  // A 10m × 10m square on a 30m board (33%-43% in X, 33%-43% in Y)
  return [
    { x: 33, y: 33 },
    { x: 43, y: 33 },
    { x: 43, y: 43 },
    { x: 33, y: 43 },
    { x: 33.5, y: 33.5 }, // closes near start
  ];
}

function makeOpenStroke(): StrokePoint[] {
  return [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
  ];
}

describe("strokePromotion — Phase M.9", () => {
  describe("strokeIsClosed", () => {
    it("returns true for a closed stroke", () => {
      expect(strokeIsClosed(makeClosedStroke())).toBe(true);
    });

    it("returns false for an open stroke", () => {
      expect(strokeIsClosed(makeOpenStroke())).toBe(false);
    });

    it("returns false for fewer than 3 points", () => {
      expect(strokeIsClosed([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
    });

    it("respects custom threshold", () => {
      // A stroke that closes at 2% distance
      const stroke: StrokePoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 2, y: 0 }, // 2% from start
      ];
      expect(strokeIsClosed(stroke, 1.5)).toBe(false);
      expect(strokeIsClosed(stroke, 3)).toBe(true);
    });
  });

  describe("polygonAreaM2", () => {
    it("computes area of a square", () => {
      const points = [
        { x: 33, y: 33 },
        { x: 43, y: 33 },
        { x: 43, y: 43 },
        { x: 33, y: 43 },
      ];
      // 10% of 30m = 3m per side, area = 9 m²
      // But boardAspect affects Y: 10% of (30 * 0.75) = 2.25m
      // Area = 3m × 2.25m = 6.75 m²
      const area = polygonAreaM2(points, 30, 0.75);
      expect(area).toBeCloseTo(6.75, 1);
    });

    it("returns 0 for fewer than 3 points", () => {
      expect(polygonAreaM2([{ x: 0, y: 0 }, { x: 1, y: 1 }], 30, 0.75)).toBe(0);
    });
  });

  describe("polygonPerimeterM", () => {
    it("computes perimeter of a square", () => {
      const points = [
        { x: 33, y: 33 },
        { x: 43, y: 33 },
        { x: 43, y: 43 },
        { x: 33, y: 43 },
      ];
      // 4 sides: 2 × (3m) + 2 × (2.25m) = 10.5m
      const perim = polygonPerimeterM(points, 30, 0.75);
      expect(perim).toBeCloseTo(10.5, 1);
    });

    it("returns 0 for fewer than 2 points", () => {
      expect(polygonPerimeterM([{ x: 0, y: 0 }], 30, 0.75)).toBe(0);
    });
  });

  describe("buildPromotionCandidate", () => {
    it("builds a candidate from a closed stroke", () => {
      const candidate = buildPromotionCandidate(
        makeClosedStroke(),
        30,
        0.75,
        "GRD",
      );
      expect(candidate).not.toBeNull();
      expect(candidate!.plane).toBe("GRD");
      expect(candidate!.suggestedName).toBe("Planting bed");
      expect(candidate!.areaM2).toBeGreaterThan(0);
      expect(candidate!.perimeterM).toBeGreaterThan(0);
    });

    it("returns null for an open stroke", () => {
      expect(buildPromotionCandidate(makeOpenStroke(), 30, 0.75, "GRD")).toBeNull();
    });

    it("returns null for area below minimum", () => {
      // Tiny stroke — 0.1% × 0.1% = ~0.0009 m² on 30m board
      const tiny: StrokePoint[] = [
        { x: 50, y: 50 },
        { x: 50.1, y: 50 },
        { x: 50.1, y: 50.1 },
        { x: 50, y: 50.1 },
        { x: 50, y: 50 },
      ];
      expect(buildPromotionCandidate(tiny, 30, 0.75, "GRD")).toBeNull();
    });

    it("uses custom suggested name", () => {
      const candidate = buildPromotionCandidate(
        makeClosedStroke(),
        30,
        0.75,
        "MAS",
        { suggestedName: "Massing volume" },
      );
      expect(candidate!.suggestedName).toBe("Massing volume");
    });

    it("defaults name by plane", () => {
      const planes: PromotionPlane[] = ["GRD", "MAS", "PLT", "SUB", "SEC"];
      for (const plane of planes) {
        const candidate = buildPromotionCandidate(makeClosedStroke(), 30, 0.75, plane);
        expect(candidate).not.toBeNull();
        expect(candidate!.suggestedName.length).toBeGreaterThan(0);
      }
    });
  });

  describe("formatPromotionChip", () => {
    it("formats the chip text per spec", () => {
      const candidate = buildPromotionCandidate(
        makeClosedStroke(),
        30,
        0.75,
        "GRD",
      )!;
      const text = formatPromotionChip(candidate);
      expect(text).toContain("Planting bed?");
      expect(text).toContain("m\u00b2");
      expect(text).toContain("m perim");
      expect(text).toContain("closed on GRD");
    });
  });

  describe("promoteStrokeToObject", () => {
    it("creates a promoted object with a unique id", () => {
      const candidate = buildPromotionCandidate(
        makeClosedStroke(),
        30,
        0.75,
        "GRD",
      )!;
      const obj = promoteStrokeToObject(candidate, "stroke-1", "material-bed");
      expect(obj.id).toBeTruthy();
      expect(obj.name).toBe("Planting bed");
      expect(obj.sourceStrokeId).toBe("stroke-1");
      expect(obj.materialId).toBe("material-bed");
      expect(obj.vertices.length).toBe(candidate.points.length);
    });

    it("preserves source stroke id for revert", () => {
      const candidate = buildPromotionCandidate(
        makeClosedStroke(),
        30,
        0.75,
        "GRD",
      )!;
      const obj = promoteStrokeToObject(candidate, "original-stroke-id");
      expect(obj.sourceStrokeId).toBe("original-stroke-id");
    });
  });

  describe("constants", () => {
    it("closure threshold is reasonable", () => {
      expect(CLOSURE_THRESHOLD_PCT).toBeGreaterThan(0);
      expect(CLOSURE_THRESHOLD_PCT).toBeLessThan(5);
    });

    it("minimum area is positive", () => {
      expect(MIN_AREA_M2).toBeGreaterThan(0);
    });
  });
});

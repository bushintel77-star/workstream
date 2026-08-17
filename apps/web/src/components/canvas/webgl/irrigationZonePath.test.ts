import { describe, expect, it } from "vitest";
import {
  buildTracedZone,
  closeZonePolygon,
  estimateZoneFlowLph,
  shouldAppendZonePoint,
  zoneAreaM2,
  zonePerimeterM,
} from "./irrigationZonePath";

// 10 m wide × 10 m tall board (scaleM 10, aspect 1) → 1% = 0.1 m.
const SCALE_M = 10;
const ASPECT = 1;

// 25%..75% on both axes = 5 m × 5 m square (25 m², 20 m perimeter).
const SQUARE = [
  { x: 25, y: 25 },
  { x: 75, y: 25 },
  { x: 75, y: 75 },
  { x: 25, y: 75 },
];

describe("shouldAppendZonePoint", () => {
  it("ignores sub-threshold travel and appends past it", () => {
    expect(shouldAppendZonePoint({ x: 0, y: 0 }, { x: 0.1, y: 0 })).toBe(false);
    expect(shouldAppendZonePoint({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

describe("closeZonePolygon", () => {
  it("closes an open ring by appending the first vertex", () => {
    expect(closeZonePolygon(SQUARE)).toHaveLength(5);
    expect(closeZonePolygon(SQUARE)[4]).toEqual({ x: 25, y: 25 });
  });

  it("leaves an already-closed ring untouched", () => {
    const closed = [...SQUARE, { x: 25, y: 25 }];
    expect(closeZonePolygon(closed)).toBe(closed);
  });
});

describe("zonePerimeterM / zoneAreaM2", () => {
  it("measures the square's perimeter and area in metres", () => {
    expect(zonePerimeterM(closeZonePolygon(SQUARE), SCALE_M, ASPECT)).toBeCloseTo(20, 4);
    expect(zoneAreaM2(SQUARE, SCALE_M, ASPECT)).toBeCloseTo(25, 4);
  });

  it("returns zero area for a degenerate (open) trace", () => {
    expect(zoneAreaM2([{ x: 0, y: 0 }, { x: 50, y: 50 }], SCALE_M, ASPECT)).toBe(0);
  });
});

describe("estimateZoneFlowLph", () => {
  it("estimates emitters along the perimeter times per-emitter flow", () => {
    // 20 m perimeter, 30 cm spacing → floor(20/0.3)+1 = 67 emitters × 2 L/h.
    expect(
      estimateZoneFlowLph(SQUARE, 30, 2, SCALE_M, ASPECT),
    ).toBeCloseTo(134, 4);
  });
});

describe("buildTracedZone", () => {
  const id = "22222222-2222-4222-8222-222222222222";

  it("commits a closed zone with defaults", () => {
    const z = buildTracedZone({ id, name: "Rear drip", kind: "drip", points: SQUARE });
    expect(z.kind).toBe("drip");
    expect(z.emitter_spacing_cm).toBe(30);
    expect(z.emitter_flow_lph).toBe(2);
    expect(z.points).toHaveLength(5); // closed
    expect(z.points[4]).toEqual({ x_pct: 25, y_pct: 25 });
  });

  it("honours explicit emitter overrides", () => {
    const z = buildTracedZone({
      id,
      name: "Lawn spray",
      kind: "spray",
      points: SQUARE,
      emitterSpacingCm: 50,
      emitterFlowLph: 4,
    });
    expect(z.kind).toBe("spray");
    expect(z.emitter_spacing_cm).toBe(50);
    expect(z.emitter_flow_lph).toBe(4);
  });
});

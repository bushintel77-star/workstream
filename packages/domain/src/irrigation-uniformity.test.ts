import { describe, expect, it } from "vitest";
import type { IrrigationZone } from "@workstream/contracts";
import {
  assessIrrigationUniformity,
  headsAlongPolyline,
} from "./irrigation-uniformity";

const SCALE = 40;

function sprayZone(
  id: string,
  points: Array<{ x: number; y: number }>,
  spacing = 3.5,
): IrrigationZone {
  return {
    id,
    name: "Spray",
    kind: "spray",
    points: points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    emitter_spacing_cm: 30,
    emitter_flow_lph: 40,
    fixture_spacing_m: spacing,
  };
}

describe("headsAlongPolyline", () => {
  it("places a head at the start and steps by spacing", () => {
    // 40 m board → 10% = 4 m. Spacing 4 m → heads at 0% and 10%.
    const heads = headsAlongPolyline(
      [
        { x: 10, y: 50 },
        { x: 30, y: 50 },
      ],
      4,
      SCALE,
      2,
      "z1",
    );
    expect(heads.length).toBeGreaterThanOrEqual(2);
    expect(heads[0]!.x).toBeCloseTo(10, 5);
    expect(heads.some((h) => Math.abs(h.x - 20) < 0.2)).toBe(true);
  });
});

describe("assessIrrigationUniformity", () => {
  it("returns empty when no spray zones", () => {
    const report = assessIrrigationUniformity(
      [
        {
          id: "d1",
          name: "Drip",
          kind: "drip",
          points: [
            { x_pct: 10, y_pct: 10 },
            { x_pct: 20, y_pct: 10 },
          ],
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2,
        },
      ],
      SCALE,
    );
    expect(report.heads).toHaveLength(0);
    expect(report.du).toBeNull();
  });

  it("reports DU/CU for a dense spray run", () => {
    const report = assessIrrigationUniformity(
      [
        sprayZone("s1", [
          { x: 20, y: 40 },
          { x: 60, y: 40 },
        ], 3),
      ],
      SCALE,
    );
    expect(report.heads.length).toBeGreaterThan(1);
    expect(report.cells.length).toBeGreaterThan(4);
    expect(report.du).not.toBeNull();
    expect(report.cu).not.toBeNull();
    expect(report.du!).toBeGreaterThan(0.2);
    expect(report.tip).toMatch(/DU ~/);
  });

  it("flags dry cells when heads are sparse", () => {
    const report = assessIrrigationUniformity(
      [
        sprayZone(
          "s2",
          [
            { x: 15, y: 50 },
            { x: 85, y: 50 },
          ],
          12,
        ),
      ],
      SCALE,
    );
    expect(report.dryCellCount).toBeGreaterThan(0);
    expect(report.du!).toBeLessThan(0.9);
  });
});

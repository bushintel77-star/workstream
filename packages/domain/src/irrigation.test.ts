import { describe, expect, it } from "vitest";
import {
  emitterCountForLine,
  summarizeIrrigationZones,
  valveCount,
} from "./irrigation";
import {
  polygonAreaFromCanvasPercent,
  polylineLengthFromCanvasPercent,
} from "./canvas-geometry";

const scale = {
  metresPerXPx: 0.05,
  metresPerYPx: 0.05,
  canvasWidthPx: 400,
  canvasHeightPx: 280,
};

describe("canvas-geometry", () => {
  it("computes square polygon area", () => {
    const square = [
      { x_pct: 10, y_pct: 10 },
      { x_pct: 30, y_pct: 10 },
      { x_pct: 30, y_pct: 30 },
      { x_pct: 10, y_pct: 30 },
    ];
    const area = polygonAreaFromCanvasPercent(square, scale);
    expect(area).toBeGreaterThan(0);
  });

  it("computes polyline length", () => {
    const line = [
      { x_pct: 0, y_pct: 0 },
      { x_pct: 20, y_pct: 0 },
    ];
    const len = polylineLengthFromCanvasPercent(line, scale);
    expect(len).toBeCloseTo(4, 1);
  });
});

describe("irrigation", () => {
  it("counts emitters along a line", () => {
    expect(emitterCountForLine(10, 30)).toBeGreaterThan(1);
  });

  it("computes valve count", () => {
    expect(valveCount(2500)).toBe(3);
  });

  it("summarises zones", () => {
    const summary = summarizeIrrigationZones(
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Zone 1",
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 30, y_pct: 0 },
          ],
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2,
        },
      ],
      scale,
    );
    expect(summary.totalLengthM).toBeGreaterThan(0);
    expect(summary.zones).toHaveLength(1);
  });
});

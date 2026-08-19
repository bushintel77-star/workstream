/**
 * Ink geometry builders — per-segment width/bleed attributes and the
 * pressure/altitude-driven stipple dot cloud.
 */

import { describe, expect, it } from "vitest";
import type { CanvasStroke } from "@workstream/contracts";
import {
  buildInkGeometry,
  buildStippleGeometry,
  strokeSegmentData,
  stipplePointsForStroke,
} from "./inkGeometry";
import { NIBS } from "./nibs";

const SCALE_M = 40;
const ASPECT = 1;

function stroke(
  id: string,
  points: Array<[number, number]>,
  telemetry: CanvasStroke["telemetry"],
  nib: CanvasStroke["nib"],
): CanvasStroke {
  return {
    id,
    points: points.map(([x_pct, y_pct]) => ({ x_pct, y_pct })),
    color: "#ff2ef6",
    width_px: 2,
    kind: "ink",
    nib,
    telemetry,
  };
}

describe("buildInkGeometry", () => {
  it("creates per-segment aWidth/aBleed instance attributes", () => {
    const geo = buildInkGeometry({
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]),
      widths: Float32Array.of(1, 0.5),
      bleeds: Float32Array.of(0.3, 0.9),
    });
    expect(geo.attributes.aWidth).toBeDefined();
    expect(geo.attributes.aBleed).toBeDefined();
    expect(geo.attributes.aWidth.count).toBe(2);
    expect(geo.attributes.aBleed.count).toBe(2);
    const aw = Array.from(geo.attributes.aWidth.array);
    const ab = Array.from(geo.attributes.aBleed.array);
    expect(aw[0]).toBeCloseTo(1);
    expect(aw[1]).toBeCloseTo(0.5);
    expect(ab[0]).toBeCloseTo(0.3);
    expect(ab[1]).toBeCloseTo(0.9);
  });

  it("normalizes missing segment data to neutral defaults", () => {
    const geo = buildInkGeometry({
      positions: new Float32Array([0, 0, 0, 10, 0, 0]),
      widths: Float32Array.of(Number.NaN),
      bleeds: new Float32Array(0),
    });
    expect(geo.attributes.aWidth.array[0]).toBe(1);
    expect(geo.attributes.aBleed.array[0]).toBe(0.5);
  });
});

describe("strokeSegmentData", () => {
  it("ink-03 is a fixed monoline (width 1 everywhere) with spacing-driven bleed", () => {
    const s = stroke(
      "ink",
      [
        [10, 50],
        [20, 50],
        [30, 50],
      ],
      [
        { pressure: 0.05, tilt_x_deg: 0, tilt_y_deg: 0 },
        { pressure: 0.95, tilt_x_deg: 0, tilt_y_deg: 0 },
        { pressure: 0.5, tilt_x_deg: 0, tilt_y_deg: 0 },
      ],
      "ink-03",
    );
    const data = strokeSegmentData(s, NIBS["ink-03"], SCALE_M, ASPECT);
    expect(Array.from(data.widths)).toEqual([1, 1]);
    // 10% of a 40 m lot = 4 m per segment → fast → bleed clamped at 1.4.
    expect(data.bleeds[0]).toBeCloseTo(1.4);
    expect(data.bleeds[1]).toBeCloseTo(1.4);
  });

  it("graphite width follows pressure (heavy press → wide segments)", () => {
    const s = stroke(
      "graphite",
      [
        [10, 50],
        [20, 50],
        [30, 50],
      ],
      [
        { pressure: 0.1, tilt_x_deg: 0, tilt_y_deg: 0 },
        { pressure: 0.9, tilt_x_deg: 0, tilt_y_deg: 0 },
        { pressure: 0.5, tilt_x_deg: 0, tilt_y_deg: 0 },
      ],
      "graphite-6b",
    );
    const data = strokeSegmentData(s, NIBS["graphite-6b"], SCALE_M, ASPECT);
    expect(data.widths[1]).toBeGreaterThan(data.widths[0]!);
    expect(data.widths[0]).toBeGreaterThan(NIBS["graphite-6b"].widthScale[0]);
  });
});

describe("stipplePointsForStroke", () => {
  function stippleStroke(pressure: number): CanvasStroke {
    const points: Array<[number, number]> = [];
    const telemetry: CanvasStroke["telemetry"] = [];
    for (let i = 0; i < 40; i++) {
      points.push([20 + i * 0.5, 50]);
      telemetry!.push({
        pressure,
        tilt_x_deg: 0,
        tilt_y_deg: 0,
        altitude_deg: 45,
      });
    }
    return stroke("stipple", points, telemetry, "stipple");
  }

  it("higher pressure keeps more dots (density) — deterministically", () => {
    const light = stipplePointsForStroke(stippleStroke(0.1), SCALE_M, ASPECT);
    const heavy = stipplePointsForStroke(stippleStroke(1.0), SCALE_M, ASPECT);
    expect(heavy.length).toBe(40); // full pressure keeps every point
    expect(light.length).toBeLessThan(heavy.length);
    // Deterministic: same input → same output.
    expect(stipplePointsForStroke(stippleStroke(0.1), SCALE_M, ASPECT)).toEqual(light);
  });

  it("dot radius scales with stylus altitude", () => {
    const upright = stroke(
      "up",
      [[30, 50]],
      [{ pressure: 1, tilt_x_deg: 0, tilt_y_deg: 0, altitude_deg: 90 }],
      "stipple",
    );
    const grazing = stroke(
      "low",
      [[30, 50]],
      [{ pressure: 1, tilt_x_deg: 45, tilt_y_deg: 0, altitude_deg: 10 }],
      "stipple",
    );
    const up = stipplePointsForStroke(upright, SCALE_M, ASPECT)[0]!;
    const low = stipplePointsForStroke(grazing, SCALE_M, ASPECT)[0]!;
    expect(up.sizePx).toBeGreaterThan(low.sizePx);
    expect(up.sizePx).toBeCloseTo(12);
  });

  it("buildStippleGeometry writes position/aSize/aPressure attributes", () => {
    const pts = stipplePointsForStroke(stippleStroke(1), SCALE_M, ASPECT);
    const geo = buildStippleGeometry(pts);
    expect(geo.attributes.position.count).toBe(pts.length);
    expect(geo.attributes.aSize.count).toBe(pts.length);
    expect(geo.attributes.aPressure.count).toBe(pts.length);
  });
});

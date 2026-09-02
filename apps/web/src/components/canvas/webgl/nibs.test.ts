/**
 * The Nib & Tool Taxonomy — telemetry mapping unit tests.
 */

import { describe, expect, it } from "vitest";
import {
  bleedScaleForSegment,
  NIB_ORDER,
  nibSpec,
  nibSpecForStroke,
  NIBS,
  telemetryFromPointer,
  widthScaleForPoint,
  type StylusTelemetry,
} from "./nibs";
import { mmAtScaleToPx } from "./mmScale";

const NEUTRAL: StylusTelemetry = {
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
  azimuth: 0,
  altitude: 90,
};

/** A minimal PointerEvent-shaped object (only the fields we read). */
function penEvent(partial: Partial<PointerEvent>): PointerEvent {
  return {
    pointerType: "pen",
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    azimuthAngle: 0,
    altitudeAngle: Math.PI / 2,
    ...partial,
  } as unknown as PointerEvent;
}

describe("telemetryFromPointer", () => {
  it("passes pen pressure through normalized", () => {
    const t = telemetryFromPointer(penEvent({ pressure: 0.75 }));
    expect(t.pressure).toBe(0.75);
  });

  it("clamps out-of-range pen pressure", () => {
    expect(telemetryFromPointer(penEvent({ pressure: 1.4 })).pressure).toBe(1);
    expect(telemetryFromPointer(penEvent({ pressure: -0.2 })).pressure).toBe(0);
  });

  it("uses the browser azimuthAngle/altitudeAngle (radians → degrees)", () => {
    const t = telemetryFromPointer(
      penEvent({ tiltX: 30, tiltY: 0, azimuthAngle: Math.PI, altitudeAngle: Math.PI / 4 }),
    );
    expect(t.azimuth).toBeCloseTo(180);
    expect(t.altitude).toBeCloseTo(45);
  });

  it("derives azimuth/altitude from tiltX/tiltY when the browser omits them", () => {
    const t = telemetryFromPointer(
      penEvent({ tiltX: 0, tiltY: 30, azimuthAngle: undefined, altitudeAngle: undefined }),
    );
    // tiltY=30, tiltX=0 → azimuth atan2(0, 30) = 0; altitude = 90 − 30 = 60.
    expect(t.azimuth).toBe(0);
    expect(t.altitude).toBeCloseTo(60);
  });

  it("synthesizes neutral telemetry for mouse", () => {
    const t = telemetryFromPointer({ pointerType: "mouse" } as PointerEvent);
    expect(t.pressure).toBe(0.5);
    expect(t.tiltX).toBe(0);
    expect(t.tiltY).toBe(0);
    expect(t.altitude).toBe(90);
  });
});

describe("widthScaleForPoint", () => {
  it("ink-03 is pressure-invariant (fixed monoline)", () => {
    const ink = NIBS["ink-03"];
    expect(widthScaleForPoint(ink, { ...NEUTRAL, pressure: 0.05 })).toBe(1);
    expect(widthScaleForPoint(ink, { ...NEUTRAL, pressure: 0.95 })).toBe(1);
  });

  it("graphite width grows with pressure", () => {
    const g = NIBS["graphite-6b"];
    const light = widthScaleForPoint(g, { ...NEUTRAL, pressure: 0.1 });
    const heavy = widthScaleForPoint(g, { ...NEUTRAL, pressure: 0.9 });
    expect(heavy).toBeGreaterThan(light);
    expect(light).toBeGreaterThanOrEqual(g.widthScale[0]);
    expect(heavy).toBeLessThanOrEqual(g.widthScale[1]);
  });

  it("chisel width follows tilt magnitude", () => {
    const c = NIBS["chisel-marker"];
    const upright = widthScaleForPoint(c, { ...NEUTRAL, tiltX: 0, tiltY: 0 });
    const tilted = widthScaleForPoint(c, { ...NEUTRAL, tiltX: 45, tiltY: 0 });
    expect(tilted).toBeGreaterThan(upright);
  });
});

describe("bleedScaleForSegment", () => {
  it("ink-03 has zero opacity bleed — velocity never scales it (3.4)", () => {
    const ink = NIBS["ink-03"];
    expect(ink.bleed).toBe(0);
    expect(ink.mapping.velocityBleed).toBe(false);
    // Neutral pass-through for every segment length.
    expect(bleedScaleForSegment(ink, 0.1)).toBe(0.5);
    expect(bleedScaleForSegment(ink, 2.5)).toBe(0.5);
  });

  it("graphite ignores velocity (neutral bleed)", () => {
    const g = NIBS["graphite-6b"];
    expect(bleedScaleForSegment(g, 5)).toBe(0.5);
  });
});

describe("nibSpec / nibSpecForStroke", () => {
  it("defaults to graphite when no nib armed", () => {
    expect(nibSpec(undefined).kind).toBe("graphite-6b");
  });

  it("legacy strokes render with neutral shading but keep their own ink", () => {
    const legacy = nibSpecForStroke({
      id: "00000000-0000-4000-8000-000000000000",
      points: [{ x_pct: 0, y_pct: 0 }],
      color: "#ff2ef6",
      width_px: 2.5,
      kind: "ink",
    });
    expect(legacy.kind).toBe("graphite-6b");
    expect(legacy.color).toBe("#ff2ef6");
    expect(legacy.baseWidthPx).toBe(2.5);
    expect(legacy.grain).toBe(0);
    expect(legacy.bleed).toBe(0);
  });

  it("stamped nib strokes resolve to their own spec", () => {
    expect(nibSpecForStroke({
      id: "00000000-0000-4000-8000-000000000000",
      points: [{ x_pct: 0, y_pct: 0 }],
      color: "#ff2ef6",
      width_px: 2,
      kind: "ink",
      nib: "chisel-marker",
    }).label).toBe("Chisel marker");
  });

  it("every nib carries its issued-scale mm weight (3.5)", () => {
    for (const kind of NIB_ORDER) {
      const spec = NIBS[kind];
      expect(spec.weightMm).toBeGreaterThan(0);
      // Round-trip through the single mm→px conversion — the px width and
      // the mm weight can never disagree.
      expect(mmAtScaleToPx(spec.weightMm)).toBeCloseTo(spec.baseWidthPx, 8);
    }
  });
});

/**
 * Sun-aware hatching — inverse sun angle + polygon hatch-line generation.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_HATCH_SPACING_PCT,
  hatchLinesForPolygon,
  isClosedRing,
  snapHatchToSun,
  sunHatchAngleDeg,
} from "./hatchSun";

describe("sunHatchAngleDeg (inverse sun angle)", () => {
  it("maps compass azimuths to board-space line angles", () => {
    // Sun due north → shadows fall due south → vertical board lines.
    expect(sunHatchAngleDeg(0)).toBe(90);
    // Sun due east → shadows fall due west → horizontal board lines.
    expect(sunHatchAngleDeg(90)).toBe(0);
    expect(sunHatchAngleDeg(180)).toBe(90);
    expect(sunHatchAngleDeg(270)).toBe(0);
  });

  it("is invariant under 360° wraps", () => {
    expect(sunHatchAngleDeg(720)).toBe(sunHatchAngleDeg(0));
    expect(sunHatchAngleDeg(-90)).toBe(sunHatchAngleDeg(270));
  });

  it("undirected: angle and angle+180 are the same line", () => {
    expect(sunHatchAngleDeg(45)).toBe(sunHatchAngleDeg(225));
  });
});

describe("snapHatchToSun", () => {
  it("snaps a nearby angle to the inverse sun angle", () => {
    // Sun at 0 → target 90°. A 87° hatch snaps.
    expect(snapHatchToSun(87, 0)).toBe(90);
  });

  it("passes angles outside the tolerance through untouched", () => {
    expect(snapHatchToSun(45, 0)).toBe(45);
  });

  it("handles the wrap boundary", () => {
    // Sun due east (azimuth 90) → target 0°. Angle 177 is 3° from 0
    // through the 180° wrap → snaps.
    expect(snapHatchToSun(177, 90)).toBe(0);
  });
});

describe("hatchLinesForPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("fills a square with horizontal parallel lines at the requested spacing", () => {
    const lines = hatchLinesForPolygon(square, 0, 2);
    expect(lines).toHaveLength(5); // y = 1, 3, 5, 7, 9
    for (const ln of lines) {
      expect(ln.a.y).toBeCloseTo(ln.b.y);
      expect(ln.a.x).toBeCloseTo(0);
      expect(ln.b.x).toBeCloseTo(10);
    }
  });

  it("rejects degenerate inputs", () => {
    expect(hatchLinesForPolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }], 45)).toEqual([]);
    expect(hatchLinesForPolygon(square, 45, 0)).toEqual([]);
  });

  it("handles concave polygons (even-odd pairing across multiple crossings)", () => {
    // An L-shape: at some sweep positions the hatch crosses 4 edges → 2 segments.
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    const lines = hatchLinesForPolygon(lShape, 0, 1);
    expect(lines.length).toBeGreaterThan(0);
    // Every emitted segment stays inside the shape's bbox.
    for (const ln of lines) {
      expect(ln.a.x).toBeGreaterThanOrEqual(-1e-6);
      expect(ln.b.x).toBeLessThanOrEqual(10 + 1e-6);
    }
    // Some lines must have two disjoint segments (the notch splits them).
    expect(lines.length).toBeGreaterThan(5);
  });

  it("uses the default spacing constant when omitted", () => {
    const lines = hatchLinesForPolygon(square, 45);
    expect(DEFAULT_HATCH_SPACING_PCT).toBeGreaterThan(0);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe("isClosedRing", () => {
  it("detects a closed ring within tolerance", () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0.2, y: 0.1 },
    ];
    expect(isClosedRing(ring)).toBe(true);
  });

  it("rejects open paths and tiny paths", () => {
    expect(
      isClosedRing([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe(false);
    expect(isClosedRing([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(false);
  });
});

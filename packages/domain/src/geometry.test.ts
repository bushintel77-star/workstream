import { describe, expect, it } from "vitest";
import { bbox, edgeLengths, polygonArea, polygonPerimeter } from "./geometry";

// A 15m × 40m rectangle centred near Stonnington (lat -37.85, lng 145.02).
// Values precomputed from the equirectangular projection used in geometry.ts.
const CENTER = { lat: -37.85, lng: 145.02 };
const METERS_PER_DEG_LAT = 110_540;
const latDeg = 1 / METERS_PER_DEG_LAT;
const lngDeg = 1 / (METERS_PER_DEG_LAT * Math.cos((CENTER.lat * Math.PI) / 180));

const halfW = (15 / 2) * lngDeg;
const halfH = (40 / 2) * latDeg;
const RING: [number, number][] = [
  [CENTER.lng - halfW, CENTER.lat - halfH],
  [CENTER.lng + halfW, CENTER.lat - halfH],
  [CENTER.lng + halfW, CENTER.lat + halfH],
  [CENTER.lng - halfW, CENTER.lat + halfH],
  [CENTER.lng - halfW, CENTER.lat - halfH],
];

describe("polygonArea", () => {
  it("returns ~600 m² for a 15×40 rectangle in Stonnington", () => {
    expect(polygonArea(RING)).toBeCloseTo(600, 0);
  });

  it("returns 0 for a degenerate ring", () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
  });

  it("is invariant under ring direction (CW vs CCW)", () => {
    const reversed = [...RING].reverse();
    expect(polygonArea(reversed)).toBeCloseTo(polygonArea(RING), 3);
  });
});

describe("polygonPerimeter", () => {
  it("returns ~110m for a 15×40 rectangle (2×15 + 2×40)", () => {
    expect(polygonPerimeter(RING)).toBeCloseTo(110, 0);
  });
});

describe("edgeLengths", () => {
  it("returns four edges for a closed quad", () => {
    const edges = edgeLengths(RING);
    expect(edges).toHaveLength(4);
  });

  it("returns the right lengths in order", () => {
    const edges = edgeLengths(RING);
    expect(edges[0].length_m).toBeCloseTo(15, 0); // S edge
    expect(edges[1].length_m).toBeCloseTo(40, 0); // E edge
    expect(edges[2].length_m).toBeCloseTo(15, 0); // N edge
    expect(edges[3].length_m).toBeCloseTo(40, 0); // W edge
  });
});

describe("bbox", () => {
  it("returns [minLng, minLat, maxLng, maxLat]", () => {
    const [minLng, minLat, maxLng, maxLat] = bbox(RING);
    expect(minLng).toBeLessThan(maxLng);
    expect(minLat).toBeLessThan(maxLat);
    expect(maxLng - minLng).toBeCloseTo(2 * halfW, 6);
  });
});

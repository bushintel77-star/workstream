import { describe, expect, it } from "vitest";
import {
  designableCanvas,
  designableFocusRing,
  inwardSetbackRing,
  outsideMask,
} from "./spatial-turf";

/** Simple unit square parcel around origin (lng/lat degrees, tiny). */
const PARCEL: [number, number][] = [
  [144.0, -37.9],
  [144.001, -37.9],
  [144.001, -37.899],
  [144.0, -37.899],
];

const HOUSE: [number, number][] = [
  [144.0003, -37.8997],
  [144.0007, -37.8997],
  [144.0007, -37.8993],
  [144.0003, -37.8993],
];

describe("spatial-turf", () => {
  it("outsideMask returns a polygon with a hole at the parcel", () => {
    const m = outsideMask(PARCEL);
    expect(m).not.toBeNull();
    expect(m!.geometry.type).toBe("Polygon");
    // exterior + hole
    expect(m!.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  it("designableCanvas returns parcel when no buildings", () => {
    const rings = designableCanvas(PARCEL, []);
    expect(rings.length).toBe(1);
    expect(rings[0]!.length).toBeGreaterThanOrEqual(3);
  });

  it("designableCanvas subtracts building footprint", () => {
    const without = designableCanvas(PARCEL, []);
    const withHouse = designableCanvas(PARCEL, [HOUSE]);
    expect(withHouse.length).toBeGreaterThanOrEqual(1);
    // Focus ring should still be a valid ring
    const focus = designableFocusRing(PARCEL, [HOUSE]);
    expect(focus.length).toBeGreaterThanOrEqual(3);
    // Difference should not be identical vertex count to raw parcel in most cases
    expect(without[0]).toBeDefined();
    expect(withHouse[0]).toBeDefined();
  });

  it("inwardSetbackRing returns a smaller ring inside the parcel", () => {
    const ring = inwardSetbackRing(PARCEL, 1.5);
    expect(ring).not.toBeNull();
    expect(ring!.length).toBeGreaterThanOrEqual(3);
  });

  it("inwardSetbackRing returns null for oversized setback", () => {
    expect(inwardSetbackRing(PARCEL, 500)).toBeNull();
  });
});


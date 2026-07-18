import { describe, expect, it } from "vitest";
import {
  buildIndicativeEasements,
  pointInEasement,
  pointInRing,
} from "./site-overlays";

const LOT: [number, number][] = [
  [144.96, -37.81],
  [144.961, -37.81],
  [144.961, -37.809],
  [144.96, -37.809],
  [144.96, -37.81],
];

describe("buildIndicativeEasements", () => {
  it("returns a southern drainage corridor for a valid lot", () => {
    const easements = buildIndicativeEasements(LOT);
    expect(easements).toHaveLength(1);
    expect(easements[0]?.label).toMatch(/Drainage easement/i);
    expect(easements[0]?.ring.length).toBeGreaterThanOrEqual(4);
  });

  it("detects points inside the easement ring", () => {
    const easements = buildIndicativeEasements(LOT);
    const ring = easements[0]!.ring;
    const midLng = (ring[0]![0] + ring[1]![0]) / 2;
    const midLat = (ring[0]![1] + ring[2]![1]) / 2;
    expect(pointInRing(midLng, midLat, ring)).toBe(true);
    expect(pointInEasement(midLng, midLat, easements)?.id).toBe(
      "easement-drainage",
    );
  });
});

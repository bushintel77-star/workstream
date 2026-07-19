import { describe, expect, it } from "vitest";
import {
  circleRingLngLat,
  tpzCirclesFromPctAnchors,
  tpzRadiusFromDbhCm,
} from "./tpz-geometry";

describe("tpz-geometry", () => {
  it("computes AS 4970 radius from DBH", () => {
    expect(tpzRadiusFromDbhCm(50)).toBe(6);
    expect(tpzRadiusFromDbhCm(10)).toBe(2);
  });

  it("projects percent anchors into metre circles", () => {
    const circles = tpzCirclesFromPctAnchors(
      [{ id: "t1", x_pct: 50, y_pct: 50, radius_m: 3 }],
      20,
      16,
    );
    expect(circles).toEqual([
      { id: "t1", x_m: 10, y_m: 8, radius_m: 3, label: undefined },
    ]);
  });

  it("builds a closed-ish lng/lat ring", () => {
    const ring = circleRingLngLat({ lng: 144.96, lat: -37.81 }, 3, 16);
    expect(ring.length).toBe(16);
  });
});

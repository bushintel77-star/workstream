import { describe, expect, it } from "vitest";
import type { CatalogPlacement, LandscapeFeature } from "@workstream/contracts";
import {
  MIN_MARQUEE_AREA_PCT,
  boxAreaPct,
  featureInBox,
  marqueeSelectRefs,
  normalizeBox,
  placementsInBox,
} from "./marqueeSelect";

const BOX = { x0: 20, y0: 20, x1: 40, y1: 40 };

function placement(id: string, x: number, y: number): CatalogPlacement {
  return {
    id,
    symbol_id: "olive-standard",
    x_pct: x,
    y_pct: y,
    rotation_deg: 0,
    scale: 1,
  };
}

function feature(
  id: string,
  type: "Polygon" | "LineString" | "Point",
  points: Array<[number, number]>,
): LandscapeFeature {
  return {
    id,
    type: "LandscapeFeature",
    metadata: {
      layer: "hardscape",
      timestamp_created: "2026-08-19T00:00:00.000Z",
      source_attribution: "human_drawn",
      user_modification_state: "accepted",
    },
    geometry: {
      type,
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: points.map(([x, y], i) => ({
        id: `${id}-v${i}`,
        pct: { x_pct: x, y_pct: y },
      })),
    },
  };
}

describe("normalizeBox / boxAreaPct", () => {
  it("normalizes any drag direction and measures area", () => {
    expect(normalizeBox({ x: 40, y: 40 }, { x: 20, y: 20 })).toEqual(BOX);
    expect(boxAreaPct(BOX)).toBe(400);
    expect(boxAreaPct({ x0: 0, y0: 0, x1: 0.4, y1: 0.5 })).toBeCloseTo(0.2);
    expect(MIN_MARQUEE_AREA_PCT).toBe(0.25);
  });
});

describe("placementsInBox", () => {
  it("selects placements whose centre falls inside the box", () => {
    const refs = placementsInBox(
      [
        placement("in-1", 30, 30),
        placement("out-1", 10, 30),
        placement("edge-1", 40, 40), // boundary inclusive
      ],
      BOX,
    );
    expect(refs.map((r) => r.id)).toEqual(["in-1", "edge-1"]);
    expect(refs[0]).toEqual({ kind: "placement", id: "in-1" });
  });
});

describe("featureInBox", () => {
  it("vertex inside the box counts", () => {
    expect(
      featureInBox(feature("f", "LineString", [[30, 30], [10, 10]]), BOX),
    ).toBe(true);
  });

  it("an edge crossing the box counts even with both endpoints outside", () => {
    // Diagonal from top-left to bottom-right passes straight through the box.
    expect(
      featureInBox(feature("f", "LineString", [[10, 10], [50, 50]]), BOX),
    ).toBe(true);
  });

  it("a fully-outside feature does not count", () => {
    expect(
      featureInBox(feature("f", "LineString", [[10, 10], [15, 12]]), BOX),
    ).toBe(false);
  });

  it("a point feature counts only when the point is inside", () => {
    expect(featureInBox(feature("f", "Point", [[30, 30]]), BOX)).toBe(true);
    expect(featureInBox(feature("f", "Point", [[5, 5]]), BOX)).toBe(false);
  });

  it("a polygon fully containing the box counts (vertices outside, edges cross)", () => {
    expect(
      featureInBox(feature("f", "Polygon", [[0, 0], [60, 0], [60, 60], [0, 60]]), BOX),
    ).toBe(true);
  });
});

describe("marqueeSelectRefs (option A)", () => {
  it("returns placements then features, never photo strokes", () => {
    const refs = marqueeSelectRefs(
      [placement("p-1", 30, 30), placement("p-out", 5, 5)],
      [feature("f-1", "LineString", [[25, 25], [45, 25]])],
      BOX,
    );
    expect(refs).toEqual([
      { kind: "placement", id: "p-1" },
      { kind: "feature", id: "f-1" },
    ]);
  });

  it("returns an empty selection for an empty box region", () => {
    expect(
      marqueeSelectRefs([placement("p-1", 30, 30)], [], {
        x0: 1,
        y0: 1,
        x1: 2,
        y1: 2,
      }),
    ).toEqual([]);
  });
});

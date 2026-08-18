/**
 * Selection picking math — hit-tests + pruning for the one selection state
 * across placements, features, and photo-trace strokes.
 */

import { describe, expect, it } from "vitest";
import type {
  CatalogPlacement,
  LandscapeFeature,
  PhotoElevation,
} from "@workstream/contracts";
import {
  dedupeSelection,
  hasRef,
  nearestFeatureId,
  nearestPlaneStrokeId,
  nearestPlacementId,
  pruneSelection,
  type SelectionRef,
} from "./selectionPick";

const placement = (id: string, x: number, y: number): CatalogPlacement => ({
  id,
  symbol_id: "olive-standard",
  x_pct: x,
  y_pct: y,
  rotation_deg: 0,
  scale: 1,
});

function feature(id: string, type: "Polygon" | "LineString", pts: Array<[number, number]>): LandscapeFeature {
  return {
    id,
    type: "LandscapeFeature",
    metadata: {
      layer: "hardscape",
      timestamp_created: "2026-08-18T00:00:00.000Z",
      source_attribution: "human_drawn",
      user_modification_state: "accepted",
    },
    geometry: {
      type,
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: pts.map(([x_pct, y_pct], i) => ({
        id: `${id}-v${i}`,
        pct: { x_pct, y_pct },
      })),
    },
  };
}

function elevation(id: string, strokeIds: string[]): PhotoElevation {
  return {
    id,
    photo_id: "photo-1",
    name: "Front facade",
    uri: "https://example.com/p.jpg",
    natural_aspect: 1.5,
    azimuth_deg: 0,
    calibration: null,
    centre_x_m: 0,
    centre_z_m: 0,
    ground_offset_m: 0,
    boundary_snap: null,
    strokes: strokeIds.map((sid) => ({
      id: sid,
      points: [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 1 },
      ],
      width_px: 2,
      color: "#0030CF",
    })),
    created_at: "2026-08-18T00:00:00.000Z",
    updated_at: "2026-08-18T00:00:00.000Z",
  };
}

describe("nearestPlacementId", () => {
  it("picks the placement within the glyph grab radius", () => {
    const id = nearestPlacementId(
      [placement("a", 50, 50), placement("b", 80, 80)],
      { x: 50.5, y: 50.2 },
      100,
    );
    expect(id).toBe("a");
  });

  it("returns null outside the grab radius", () => {
    expect(
      nearestPlacementId([placement("a", 50, 50)], { x: 10, y: 10 }, 100),
    ).toBeNull();
  });
});

describe("nearestFeatureId", () => {
  it("picks the nearest linework within the grab radius", () => {
    const features = [
      feature("line-a", "LineString", [[20, 20], [30, 20]]),
      feature("line-b", "LineString", [[60, 60], [70, 60]]),
    ];
    expect(nearestFeatureId(features, { x: 25, y: 20.6 }, 100)).toBe("line-a");
    expect(nearestFeatureId(features, { x: 5, y: 5 }, 100)).toBeNull();
  });

  it("hits a polygon edge, including the closing segment", () => {
    const features = [
      feature("poly", "Polygon", [[10, 10], [30, 10], [30, 30], [10, 30]]),
    ];
    // Near the closing edge (10,30)-(10,10): x=10.6, y=20.
    expect(nearestFeatureId(features, { x: 10.6, y: 20 }, 100)).toBe("poly");
  });
});

describe("nearestPlaneStrokeId", () => {
  it("picks the plane stroke within 0.35 m in plane space", () => {
    const strokes = [
      { id: "s1", points: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }], width_px: 2, color: "#0030CF" },
    ];
    expect(nearestPlaneStrokeId(strokes, { x_m: 1, y_m: 0.2 })).toBe("s1");
    expect(nearestPlaneStrokeId(strokes, { x_m: 1, y_m: 2 })).toBeNull();
  });
});

describe("selection ref helpers", () => {
  const ref: SelectionRef = { kind: "placement", id: "a" };

  it("dedupes identical refs", () => {
    expect(dedupeSelection([ref, ref, { ...ref }])).toHaveLength(1);
  });

  it("matches refs by kind + id + elevation owner", () => {
    expect(hasRef([{ kind: "photoStroke", id: "s", elevationId: "e1" }], { kind: "photoStroke", id: "s", elevationId: "e1" })).toBe(true);
    expect(hasRef([{ kind: "photoStroke", id: "s", elevationId: "e1" }], { kind: "photoStroke", id: "s", elevationId: "e2" })).toBe(false);
  });
});

describe("pruneSelection", () => {
  it("drops refs whose entities left the document", () => {
    const refs: SelectionRef[] = [
      { kind: "placement", id: "gone" },
      { kind: "placement", id: "kept" },
      { kind: "feature", id: "kept" },
      { kind: "feature", id: "gone" },
      { kind: "photoStroke", id: "s1", elevationId: "e1" },
      { kind: "photoStroke", id: "s2", elevationId: "e1" },
    ];
    const pruned = pruneSelection(refs, {
      placements: [placement("kept", 50, 50)],
      features: [feature("kept", "LineString", [[0, 0], [1, 0]])],
      photoElevations: [elevation("e1", ["s1"])],
    });
    expect(pruned.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "placement:kept",
      "feature:kept",
      "photoStroke:s1",
    ]);
  });
});

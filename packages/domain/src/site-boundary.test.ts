import { describe, expect, it } from "vitest";
import {
  buildBoundaryFromGeoRing,
  computeBoundaryMetrics,
  deleteBoundaryVertex,
  geoJsonPolygonToCanvasMetres,
  insertBoundaryVertex,
  lockBoundary,
  moveBoundaryVertex,
} from "./site-boundary";

const PROJECT = "22222222-2222-2222-2222-222222222222";

describe("site-boundary HITL", () => {
  it("builds dual-coord vertices from a geo ring with live metrics", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [144.96, -37.81],
        [144.961, -37.81],
        [144.961, -37.809],
        [144.96, -37.809],
      ],
      source: "GIS_PARCEL",
      sourceKind: "vicmap",
      aiConfidence: 0.91,
    });
    expect(draft.status).toBe("UNVERIFIED");
    expect(draft.vertices).toHaveLength(4);
    expect(draft.vertices[0]!.source).toBe("GIS_PARCEL");
    expect(draft.calculated_metrics.total_area_m2).toBeGreaterThan(1000);
    expect(draft.calculated_metrics.perimeter_m).toBeGreaterThan(100);
    expect(draft.geo_reference.crs).toBe("EPSG:4326");
  });

  it("recalculates area when a vertex is dragged", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [144.96, -37.81],
        [144.961, -37.81],
        [144.961, -37.809],
        [144.96, -37.809],
      ],
      source: "AI_GENERATED",
      sourceKind: "ai_trace",
    });
    const boundary = {
      id: "11111111-1111-1111-1111-111111111111",
      updated_at: new Date().toISOString(),
      ...draft,
    };
    const before = boundary.calculated_metrics.total_area_m2;
    const v = boundary.vertices[1]!;
    const moved = moveBoundaryVertex(boundary, v.vertex_id, {
      x: v.canvas_coords.x + 8,
      y: v.canvas_coords.y,
    });
    expect(moved.vertices.find((x) => x.vertex_id === v.vertex_id)!.source).toBe(
      "HUMAN_EDITED",
    );
    expect(moved.calculated_metrics.total_area_m2).not.toBe(before);
  });

  it("inserts and deletes nodes while keeping winding order", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [144.96, -37.81],
        [144.961, -37.81],
        [144.961, -37.809],
        [144.96, -37.809],
      ],
      source: "AI_GENERATED",
      sourceKind: "ai_trace",
    });
    const boundary = {
      id: "11111111-1111-1111-1111-111111111111",
      updated_at: new Date().toISOString(),
      ...draft,
    };
    const a = boundary.vertices[0]!;
    const b = boundary.vertices[1]!;
    const mid = {
      x: (a.canvas_coords.x + b.canvas_coords.x) / 2,
      y: (a.canvas_coords.y + b.canvas_coords.y) / 2,
    };
    const withNode = insertBoundaryVertex(boundary, a.vertex_id, mid);
    expect(withNode.vertices).toHaveLength(5);
    expect(withNode.vertices.map((v) => v.sequence_index)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    const added = withNode.vertices.find((v) => v.source === "HUMAN_ADDED")!;
    const trimmed = deleteBoundaryVertex(withNode, added.vertex_id);
    expect(trimmed.vertices).toHaveLength(4);
  });

  it("locks vertices into a read-only VERIFIED baseline", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [144.96, -37.81],
        [144.961, -37.81],
        [144.961, -37.809],
        [144.96, -37.809],
      ],
      source: "GIS_PARCEL",
      sourceKind: "vicmap",
    });
    const boundary = {
      id: "11111111-1111-1111-1111-111111111111",
      updated_at: new Date().toISOString(),
      ...draft,
    };
    const locked = lockBoundary(boundary, "user_1");
    expect(locked.status).toBe("VERIFIED");
    expect(locked.vertices.every((v) => v.is_locked)).toBe(true);
    expect(() =>
      moveBoundaryVertex(locked, locked.vertices[0]!.vertex_id, {
        x: 0,
        y: 0,
      }),
    ).toThrow(/locked/i);
  });

  it("computeBoundaryMetrics matches shoelace helpers", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
        [0, 0.001],
      ],
      source: "HUMAN_ADDED",
      sourceKind: "manual",
    });
    const m = computeBoundaryMetrics(draft.vertices, 0.5);
    expect(m.ai_confidence).toBe(0.5);
    expect(m.total_area_m2).toBeGreaterThan(0);
  });

  it("projects a GeoJSON house into the boundary canvas-metre frame", () => {
    const draft = buildBoundaryFromGeoRing({
      projectId: PROJECT,
      ring: [
        [144.96, -37.81],
        [144.961, -37.81],
        [144.961, -37.809],
        [144.96, -37.809],
      ],
      source: "GIS_PARCEL",
      sourceKind: "vicmap",
    });
    const origin = draft.geo_reference.canvas_origin_geo;
    const house = geoJsonPolygonToCanvasMetres(
      {
        type: "Polygon",
        coordinates: [
          [
            [144.9602, -37.8098],
            [144.9606, -37.8098],
            [144.9606, -37.8094],
            [144.9602, -37.8094],
            [144.9602, -37.8098],
          ],
        ],
      },
      origin,
    );
    expect(house.length).toBe(4);
    // House must sit inside the title canvas-metre bbox.
    const bx = draft.vertices.map((v) => v.canvas_coords.x);
    const by = draft.vertices.map((v) => v.canvas_coords.y);
    expect(Math.min(...house.map((p) => p.x))).toBeGreaterThan(Math.min(...bx));
    expect(Math.max(...house.map((p) => p.x))).toBeLessThan(Math.max(...bx));
    expect(Math.min(...house.map((p) => p.y))).toBeGreaterThan(Math.min(...by));
    expect(Math.max(...house.map((p) => p.y))).toBeLessThan(Math.max(...by));
  });
});

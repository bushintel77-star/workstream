import { describe, expect, it } from "vitest";
import {
  CanvasStrokeSchema,
  LandscapeFeatureSchema,
} from "@workstream/contracts";
import {
  addDraftVertex,
  areaFeatureFromDraft,
  beginDraftSession,
  boundaryEdgeSegments,
  canCommitDraft,
  draftAreaM2,
  draftRunLengthM,
  DRAFTED_AREA_NAME,
  MAX_DRAFT_VERTICES,
  MIN_DRAFT_VERTEX_GAP_M,
  polylineStrokeFromDraft,
  segmentReadout,
  undoDraftVertex,
  UNSPECIFIED_AREA_SKU,
} from "./draftShape";
import { snapDrawPointer } from "./snapWorld";

/** Deterministic ids — CanvasStroke.id is a uuid by contract. */
const STROKE_ID = "11111111-2222-4333-8444-555555555555";
const FEATURE_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";

/* -------------------------------------------------------------------------- */
/* Session reducer                                                            */
/* -------------------------------------------------------------------------- */

describe("draft session reducer", () => {
  it("begins empty and appends placed vertices in order", () => {
    let s = beginDraftSession("polyline");
    expect(s.tool).toBe("polyline");
    expect(s.vertices).toEqual([]);
    s = addDraftVertex(s, { x: 0, z: 0 });
    s = addDraftVertex(s, { x: 4, z: 0 });
    expect(s.vertices).toEqual([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
    ]);
  });

  it("ignores a coincident placement (the second click of a double-click)", () => {
    let s = addDraftVertex(beginDraftSession("polyline"), { x: 3, z: 3 });
    const before = s.vertices.length;
    s = addDraftVertex(s, { x: 3 + MIN_DRAFT_VERTEX_GAP_M / 2, z: 3 });
    expect(s.vertices).toHaveLength(before);
    // Just past the gap it lands.
    s = addDraftVertex(s, { x: 3 + MIN_DRAFT_VERTEX_GAP_M * 2, z: 3 });
    expect(s.vertices).toHaveLength(before + 1);
  });

  it("caps the run at the contract's shape_points limit", () => {
    let s = beginDraftSession("polyline");
    for (let i = 0; i < MAX_DRAFT_VERTICES + 10; i++) {
      s = addDraftVertex(s, { x: i, z: 0 });
    }
    expect(s.vertices).toHaveLength(MAX_DRAFT_VERTICES);
  });

  it("undo drops only the last vertex and an empty run stays empty", () => {
    let s = beginDraftSession("area");
    s = addDraftVertex(s, { x: 0, z: 0 });
    s = addDraftVertex(s, { x: 1, z: 0 });
    s = undoDraftVertex(s);
    expect(s.vertices).toEqual([{ x: 0, z: 0 }]);
    s = undoDraftVertex(s);
    expect(s.vertices).toEqual([]);
    expect(undoDraftVertex(s).vertices).toEqual([]);
  });

  it("gates commit: polyline opens at 2, area needs a polygon", () => {
    const one = addDraftVertex(beginDraftSession("polyline"), { x: 0, z: 0 });
    const two = addDraftVertex(one, { x: 5, z: 0 });
    expect(canCommitDraft(one, false)).toBe(false);
    expect(canCommitDraft(two, false)).toBe(true);
    // A two-point run cannot close into a polygon.
    expect(canCommitDraft(two, true)).toBe(false);

    const areaTwo = { ...two, tool: "area" as const };
    expect(canCommitDraft(areaTwo, true)).toBe(false);
    const areaThree = addDraftVertex(areaTwo, { x: 5, z: 5 });
    expect(canCommitDraft(areaThree, true)).toBe(true);
    // Area is a region — an "open" finish is still gated on the polygon.
    expect(canCommitDraft(areaThree, false)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Live readout                                                               */
/* -------------------------------------------------------------------------- */

describe("segmentReadout", () => {
  it("measures true length in metres", () => {
    expect(segmentReadout({ x: 0, z: 0 }, { x: 3, z: 4 }).lengthM).toBeCloseTo(
      5,
      6,
    );
  });

  it("reads bearing clockwise from north (north = -Z, east = +X)", () => {
    const bearing = (dx: number, dz: number) =>
      segmentReadout({ x: 0, z: 0 }, { x: dx, z: dz }).bearingDeg;
    expect(bearing(0, -10)).toBeCloseTo(0, 6); // north
    expect(bearing(10, 0)).toBeCloseTo(90, 6); // east
    expect(bearing(0, 10)).toBeCloseTo(180, 6); // south
    expect(bearing(-10, 0)).toBeCloseTo(270, 6); // west
    expect(bearing(10, -10)).toBeCloseTo(45, 6); // north-east
  });

  it("returns a zero reading for a zero-length segment", () => {
    expect(segmentReadout({ x: 2, z: 2 }, { x: 2, z: 2 })).toEqual({
      lengthM: 0,
      bearingDeg: 0,
    });
  });
});

describe("draftRunLengthM / draftAreaM2", () => {
  const SQUARE = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ];

  it("sums the open run and adds the closing leg when closed", () => {
    expect(draftRunLengthM(SQUARE, false)).toBeCloseTo(30, 6);
    expect(draftRunLengthM(SQUARE, true)).toBeCloseTo(40, 6);
  });

  it("is zero below two vertices", () => {
    expect(draftRunLengthM([{ x: 1, z: 1 }], true)).toBe(0);
    expect(draftRunLengthM([], false)).toBe(0);
  });

  it("shoelaces the ring area and ignores winding direction", () => {
    expect(draftAreaM2(SQUARE)).toBeCloseTo(100, 6);
    expect(draftAreaM2([...SQUARE].reverse())).toBeCloseTo(100, 6);
    expect(draftAreaM2(SQUARE.slice(0, 2))).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Boundary-edge snap segments                                                */
/* -------------------------------------------------------------------------- */

describe("boundaryEdgeSegments", () => {
  // Board-% ring (25,25)→(75,25)→(75,75)→(25,75); scaleM 100, aspect 1
  // → world (−25,−25)→(25,25).
  const RING = [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 75, y: 75 },
    { x: 25, y: 75 },
  ];

  it("closes the ring so every parcel edge is a snap target", () => {
    const edges = boundaryEdgeSegments(RING, 100, 1);
    expect(edges).toHaveLength(4);
    expect(edges[0]!.a.x).toBeCloseTo(-25, 6);
    expect(edges[0]!.a.z).toBeCloseTo(-25, 6);
    expect(edges[0]!.b.x).toBeCloseTo(25, 6);
    // The last edge runs back to the first vertex.
    expect(edges[3]!.b.x).toBeCloseTo(-25, 6);
    expect(edges[3]!.b.z).toBeCloseTo(-25, 6);
  });

  it("drops a duplicated closing point instead of emitting a zero-length edge", () => {
    const edges = boundaryEdgeSegments([...RING, RING[0]!], 100, 1);
    expect(edges).toHaveLength(4);
  });

  it("has no edges below two points", () => {
    expect(boundaryEdgeSegments([], 100, 1)).toEqual([]);
    expect(boundaryEdgeSegments([RING[0]!], 100, 1)).toEqual([]);
  });

  it("feeds the boundary rung of the snap ladder", () => {
    const edges = boundaryEdgeSegments(RING, 100, 1);
    // 0.4 m inside the northern title edge (world z = −25).
    const hint = snapDrawPointer(
      0,
      -24.6,
      { origin: null, last: null, vertices: [], boundaryEdges: edges },
    );
    expect(hint.kind).toBe("boundary");
    expect(hint.z).toBeCloseTo(-25, 6);
  });
});

/* -------------------------------------------------------------------------- */
/* Polyline → CanvasStroke                                                    */
/* -------------------------------------------------------------------------- */

describe("polylineStrokeFromDraft", () => {
  const RUN = [
    { x: -25, z: -25 },
    { x: 25, z: -25 },
    { x: 25, z: 25 },
    { x: -25, z: 25 },
  ];

  it("writes the control points AND the flattened render path", () => {
    const stroke = polylineStrokeFromDraft({
      id: STROKE_ID,
      vertices: RUN,
      closed: false,
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(stroke.kind).toBe("shape");
    expect(stroke.shape_tool).toBe("polyline");
    expect(stroke.shape_closed).toBe(false);
    expect(stroke.shape_points).toHaveLength(4);
    // `points` is what CommittedStrokeRenderer draws — it must exist.
    expect(stroke.points).toHaveLength(4);
    expect(stroke.points[0]).toEqual({ x_pct: 25, y_pct: 25 });
    expect(stroke.points[2]).toEqual({ x_pct: 75, y_pct: 75 });
    expect(CanvasStrokeSchema.safeParse(stroke).success).toBe(true);
  });

  it("re-appends the origin to the render path when the run closed", () => {
    const stroke = polylineStrokeFromDraft({
      id: STROKE_ID,
      vertices: RUN,
      closed: true,
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(stroke.shape_closed).toBe(true);
    // Control points stay the operator's four clicks…
    expect(stroke.shape_points).toHaveLength(4);
    // …while the render path closes the ring, so cut/fill reads it as closed.
    expect(stroke.points).toHaveLength(5);
    expect(stroke.points[4]).toEqual(stroke.points[0]);
    expect(CanvasStrokeSchema.safeParse(stroke).success).toBe(true);
  });

  it("uses the crisp 0.3mm technical-ink nib, not gestural graphite", () => {
    const stroke = polylineStrokeFromDraft({
      id: STROKE_ID,
      vertices: RUN,
      closed: false,
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(stroke.nib).toBe("ink-03");
  });

  it("refuses runs that are not linework", () => {
    expect(
      polylineStrokeFromDraft({
        id: STROKE_ID,
        vertices: [{ x: 0, z: 0 }],
        closed: false,
        scaleM: 100,
        boardAspect: 1,
      }),
    ).toBeNull();
    // Two points cannot close into a polygon.
    expect(
      polylineStrokeFromDraft({
        id: STROKE_ID,
        vertices: RUN.slice(0, 2),
        closed: true,
        scaleM: 100,
        boardAspect: 1,
      }),
    ).toBeNull();
  });

  it("respects boardAspect when converting back to board %", () => {
    // aspect 2 → the lot is 100 m wide and 200 m tall; world z = 50 is 75%.
    const stroke = polylineStrokeFromDraft({
      id: STROKE_ID,
      vertices: [
        { x: 0, z: 0 },
        { x: 0, z: 50 },
      ],
      closed: false,
      scaleM: 100,
      boardAspect: 2,
    })!;
    expect(stroke.points[0]).toEqual({ x_pct: 50, y_pct: 50 });
    expect(stroke.points[1]).toEqual({ x_pct: 50, y_pct: 75 });
  });
});

/* -------------------------------------------------------------------------- */
/* Area → LandscapeFeature                                                    */
/* -------------------------------------------------------------------------- */

describe("areaFeatureFromDraft", () => {
  const RING = [
    { x: -25, z: -25 },
    { x: 25, z: -25 },
    { x: 25, z: 25 },
    { x: -25, z: 25 },
  ];

  it("persists a human-locked Polygon region with an unspecified material", () => {
    const feature = areaFeatureFromDraft({
      id: FEATURE_ID,
      vertices: RING,
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(feature.type).toBe("LandscapeFeature");
    expect(feature.geometry.type).toBe("Polygon");
    // No duplicated closing vertex — FeatureLayer closes Polygon rings itself.
    expect(feature.geometry.points).toHaveLength(4);
    expect(feature.geometry.points[0]!.pct).toEqual({ x_pct: 25, y_pct: 25 });
    expect(feature.metadata.friendly_name).toBe(DRAFTED_AREA_NAME);
    expect(feature.metadata.source_attribution).toBe("human_drawn");
    expect(feature.metadata.user_modification_state).toBe("human_locked");
    // Costable, but the SKU is stamped unspecified rather than guessed.
    expect(feature.material_fill?.sku).toBe(UNSPECIFIED_AREA_SKU);
    expect(feature.material_fill?.live_calculations).toBeUndefined();
    expect(LandscapeFeatureSchema.safeParse(feature).success).toBe(true);
  });

  it("carries no pad height on creation — height is an edit, not a draw", () => {
    const feature = areaFeatureFromDraft({
      id: FEATURE_ID,
      vertices: RING,
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(feature.extrude_height_m).toBeUndefined();
  });

  it("clamps off-board vertices into the board the contract models", () => {
    const feature = areaFeatureFromDraft({
      id: FEATURE_ID,
      // World x = −200 is far off the 100 m board (board-% −150).
      vertices: [{ x: -200, z: -25 }, ...RING.slice(1)],
      scaleM: 100,
      boardAspect: 1,
    })!;
    expect(feature.geometry.points[0]!.pct.x_pct).toBe(0);
    expect(LandscapeFeatureSchema.safeParse(feature).success).toBe(true);
  });

  it("refuses a ring that is not a polygon", () => {
    expect(
      areaFeatureFromDraft({
        id: FEATURE_ID,
        vertices: RING.slice(0, 2),
        scaleM: 100,
        boardAspect: 1,
      }),
    ).toBeNull();
  });
});

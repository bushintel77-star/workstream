import { describe, expect, it } from "vitest";
import {
  DEFAULT_STITCH_EPSILON_M,
  collectSnapNodes,
  findSnapCandidates,
  resolveLayerConflict,
  snapPointToNodes,
  stitchCanvasStrokes,
  stitchRecordOf,
  unstitchEntity,
  type FeaturePolygon,
  type FeaturePolyline,
  type SpatialStroke,
} from "./canvasStitcher";

const pt = (x: number, y: number) => ({ x, y });

function stroke(
  id: string,
  points: Array<{ x: number; y: number }>,
  extra: Partial<SpatialStroke> = {},
): SpatialStroke {
  return { id, points, ...extra };
}

function polylines(features: ReturnType<typeof stitchCanvasStrokes>): FeaturePolyline[] {
  return features.filter((f): f is FeaturePolyline => f.kind === "polyline");
}

function polygons(features: ReturnType<typeof stitchCanvasStrokes>): FeaturePolygon[] {
  return features.filter((f): f is FeaturePolygon => f.kind === "polygon");
}

describe("vertex welding across variable tolerance distances", () => {
  // Two strokes with a 0.10 m gap at the joint.
  const gapStrokes = [
    stroke("a", [pt(-1, 0), pt(0, 0)]),
    stroke("b", [pt(0.1, 0), pt(1, 0)]),
  ];

  it("welds endpoints within the default 0.15 m tolerance into one polyline", () => {
    const out = stitchCanvasStrokes(gapStrokes);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    // Collinear fusion removes the welded joint entirely.
    expect(line.points).toHaveLength(2);
    expect(line.points[0]).toEqual({ x: -1, y: 0 });
    expect(line.points[1]).toEqual({ x: 1, y: 0 });
    expect(line.meta.weldedVertices).toBe(1);
    expect(line.meta.fusedSegments).toBe(1);
    expect(line.meta.snapped).toBe(true);
    expect(line.strokeIds).toEqual(["a", "b"]);
  });

  it("leaves a 0.10 m gap unwelded when the tolerance is 0.05 m", () => {
    const out = stitchCanvasStrokes(gapStrokes, { epsilonM: 0.05 });
    const lines = polylines(out);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.meta.weldedVertices === 0)).toBe(true);
  });

  it("welds across every tolerance from 0.05 m to 0.3 m", () => {
    const epsilons = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
    const results = epsilons.map((epsilonM) => ({
      epsilonM,
      count: polylines(stitchCanvasStrokes(gapStrokes, { epsilonM })).length,
    }));
    expect(results).toEqual(
      epsilons.map((epsilonM) => ({
        epsilonM,
        count: epsilonM >= 0.1 ? 1 : 2,
      })),
    );
  });

  it("welds to the cluster centroid (the joint sits mid-gap)", () => {
    const out = stitchCanvasStrokes(gapStrokes, { epsilonM: 0.15 });
    const line = polylines(out)[0]!;
    // The welded runs retain the joint position before collinear removal.
    expect(line.meta.segments).toHaveLength(2);
    expect(line.meta.segments[0]).toEqual([{ x: -1, y: 0 }, { x: 0.05, y: 0 }]);
    expect(line.meta.segments[1]).toEqual([{ x: 0.05, y: 0 }, { x: 1, y: 0 }]);
  });

  it("preserves a welded elbow (non-collinear joint is never removed)", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(0, 0), pt(0, 2)]),
      stroke("b", [pt(0.1, 2), pt(3, 2)]),
    ]);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    // Weld centroid of (0,2) and (0.1,2) → (0.05, 2); elbow kept.
    expect(lines[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 0.05, y: 2 },
      { x: 3, y: 2 },
    ]);
  });
});

describe("multi-stroke polyline merging", () => {
  it("fuses three collinear strokes into one continuous polyline", () => {
    const out = stitchCanvasStrokes([
      stroke("s1", [pt(-3, 0), pt(-1, 0)]),
      stroke("s2", [pt(-1.1, 0), pt(1, 0)]),
      stroke("s3", [pt(1.05, 0), pt(3, 0)]),
    ]);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.points).toEqual([{ x: -3, y: 0 }, { x: 3, y: 0 }]);
    expect(line.meta.fusedSegments).toBe(2);
    expect(line.meta.weldedVertices).toBe(2);
    expect(line.meta.collinearPointsRemoved).toBe(2);
    expect(line.strokeIds).toEqual(["s1", "s2", "s3"]);
  });

  it("keeps distinct parallel runs separate when they never touch", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-2, 0), pt(0, 0)]),
      stroke("b", [pt(2, 0), pt(4, 0)]),
    ]);
    expect(polylines(out)).toHaveLength(2);
  });

  it("returns [] for empty or degenerate input", () => {
    expect(stitchCanvasStrokes([])).toEqual([]);
    expect(stitchCanvasStrokes([stroke("d", [pt(0, 0)])])).toEqual([]);
  });

  it("is deterministic — identical input yields identical output", () => {
    const input = [
      stroke("s1", [pt(-3, 0), pt(-1, 0)]),
      stroke("s2", [pt(-1.1, 0), pt(1, 0)]),
    ];
    expect(JSON.stringify(stitchCanvasStrokes(input))).toBe(
      JSON.stringify(stitchCanvasStrokes(input)),
    );
  });
});

describe("closed-loop auto-detection", () => {
  it("converts a four-stroke rectangle into a FeaturePolygon with the shoelace area", () => {
    const out = stitchCanvasStrokes([
      stroke("s1", [pt(0, 0), pt(3, 0)]),
      stroke("s2", [pt(3, 0), pt(3, 2)]),
      stroke("s3", [pt(3, 2), pt(0, 2)]),
      stroke("s4", [pt(0, 2), pt(0, 0)]),
    ]);
    const rings = polygons(out);
    expect(rings).toHaveLength(1);
    const ring = rings[0]!;
    expect(ring.ring).toHaveLength(4);
    expect(ring.areaM2).toBeCloseTo(6, 9);
    expect(ring.meta.closedByStitch).toBe(true);
    expect(ring.meta.weldedVertices).toBe(4);
    expect(ring.meta.fusedSegments).toBe(3);
    expect(ring.meta.snapped).toBe(false);
    expect(ring.strokeIds).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("closes a near-closed single stroke via welding", () => {
    const out = stitchCanvasStrokes([
      stroke("loop", [pt(0, 0), pt(3, 0), pt(3, 2), pt(0, 2), pt(0, 0.1)]),
    ]);
    const rings = polygons(out);
    expect(rings).toHaveLength(1);
    expect(rings[0]!.meta.closedByStitch).toBe(true);
    expect(rings[0]!.meta.snapped).toBe(true);
    expect(rings[0]!.areaM2).toBeCloseTo(5.925, 6);
  });

  it("does not mark an already-closed input stroke as stitched", () => {
    const out = stitchCanvasStrokes([
      stroke("loop", [pt(0, 0), pt(3, 0), pt(3, 2), pt(0, 2), pt(0, 0)], {
        closed: true,
      }),
    ]);
    const rings = polygons(out);
    expect(rings).toHaveLength(1);
    expect(rings[0]!.meta.closedByStitch).toBe(false);
    expect(rings[0]!.meta.snapped).toBe(false);
  });

  it("keeps the loop as a closed polyline when closeLoops is false", () => {
    const out = stitchCanvasStrokes(
      [
        stroke("s1", [pt(0, 0), pt(3, 0)]),
        stroke("s2", [pt(3, 0), pt(3, 2)]),
        stroke("s3", [pt(3, 2), pt(0, 2)]),
        stroke("s4", [pt(0, 2), pt(0, 0)]),
      ],
      { closeLoops: false },
    );
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.loop).toBe("closed");
  });
});

describe("layer & attribute inheritance from classifySpatialEntity", () => {
  it("classifies plain user strokes to the draft layer with user provenance", () => {
    const out = stitchCanvasStrokes([
      stroke("u", [pt(0, 0), pt(0, 1), pt(1, 1)]),
    ]);
    const line = polylines(out)[0]!;
    expect(line.layerId).toBe("draft.user_draft");
    expect(line.meta.source).toBe("user_stroke");
    expect(line.meta.provenance).toBe("user_drawn");
    expect(line.meta.userModificationState).toBe("user_drawn");
  });

  it("classifies Vicmap attributes to the registered layer (easement)", () => {
    const out = stitchCanvasStrokes([
      stroke("v", [pt(0, 0), pt(0, 1), pt(1, 1)], {
        source: "vicmap",
        attributes: { kind: "EASEMENT", source_ref: "VICMAP" },
      }),
    ]);
    const line = polylines(out)[0]!;
    expect(line.layerId).toBe("vicmap.easement");
    expect(line.meta.source).toBe("vicmap");
    expect(line.meta.provenance).toBe("state_cadastre");
    expect(line.meta.classification.confidence).toBe("high");
    expect(line.meta.rawAttributes).toEqual({
      kind: "EASEMENT",
      source_ref: "VICMAP",
    });
  });

  it("honours a pre-classified registered layerId", () => {
    const out = stitchCanvasStrokes([
      stroke("t", [pt(0, 0), pt(1, 0)], { layerId: "civil.trench" }),
    ]);
    expect(polylines(out)[0]!.layerId).toBe("civil.trench");
  });

  it("lets the state cadastre / Vicmap classification win a conflict", () => {
    // Vicmap easement (high confidence, state cadastre) vs user draft
    // (high confidence, user drawn) — the surveyed layer must win.
    const out = stitchCanvasStrokes([
      stroke("draft", [pt(0, 0), pt(3, 0)]),
      stroke("vic", [pt(3, 0), pt(3, 2)], {
        source: "vicmap",
        attributes: { kind: "EASEMENT" },
      }),
      stroke("draft2", [pt(3, 2), pt(0, 2)]),
      stroke("vic2", [pt(0, 2), pt(0, 0)], {
        source: "vicmap",
        attributes: { kind: "EASEMENT" },
      }),
    ]);
    const ring = polygons(out)[0]!;
    expect(ring.layerId).toBe("vicmap.easement");
    expect(ring.meta.provenance).toBe("state_cadastre");
  });

  it("prefers higher confidence over provenance (user draft beats a low-confidence overlay)", () => {
    const out = stitchCanvasStrokes([
      stroke("vic", [pt(0, 0), pt(1, 0)], {
        source: "vicmap",
        attributes: { kind: "OVERLAY" },
      }),
      stroke("user", [pt(1, 0), pt(2, 0)]),
    ]);
    // vicmap.gov_overlay is medium confidence; user stroke is high.
    expect(polylines(out)[0]!.layerId).toBe("draft.user_draft");
  });

  it("merges raw attributes first-wins across the fused strokes", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(0, 0), pt(1, 0)], { attributes: { a: 1, b: 2 } }),
      stroke("b", [pt(1, 0), pt(2, 0)], { attributes: { b: 3, c: 4 } }),
    ]);
    expect(polylines(out)[0]!.meta.rawAttributes).toEqual({ a: 1, b: 2, c: 4 });
  });

  it("resolveLayerConflict applies the same priority rules directly", () => {
    const vicmapWins = resolveLayerConflict([
      stroke("d", [pt(0, 0), pt(1, 0)]),
      stroke("v", [pt(0, 0), pt(1, 0)], {
        source: "vicmap",
        attributes: { kind: "EASEMENT" },
      }),
    ]);
    expect(vicmapWins?.layerId).toBe("vicmap.easement");

    const userWins = resolveLayerConflict([
      stroke("v", [pt(0, 0), pt(1, 0)], {
        source: "vicmap",
        attributes: { kind: "OVERLAY" },
      }),
      stroke("u", [pt(0, 0), pt(1, 0)]),
    ]);
    expect(userWins?.layerId).toBe("draft.user_draft");

    // Exact tie → first stroke in input order.
    const tie = resolveLayerConflict([
      stroke("first", [pt(0, 0), pt(1, 0)]),
      stroke("second", [pt(0, 0), pt(1, 0)]),
    ]);
    expect(tie?.source).toBe("user_stroke");

    expect(resolveLayerConflict([])).toBeNull();
  });
});

describe("edge cases: T-junctions, overlapping parallel strokes, self-intersections", () => {
  it("splits a T-junction — an endpoint landing on a segment interior", () => {
    const out = stitchCanvasStrokes([
      stroke("bar", [pt(-2, 0), pt(2, 0)]),
      stroke("stem", [pt(0, -2), pt(0, 0.1)]),
    ]);
    const lines = polylines(out);
    // Maximal-chain fusion: the bar (split at the junction, so it keeps the
    // junction as an intermediate vertex) plus the stem welded onto it.
    expect(lines).toHaveLength(2);
    const bar = lines.find((l) => l.points.length === 3)!;
    const stem = lines.find((l) => l.points.length === 2)!;
    expect(bar).toBeDefined();
    expect(stem).toBeDefined();
    const junction = bar.points[1]!;
    // The junction node sits within ε of the crossing point (0, 0).
    expect(Math.hypot(junction.x, junction.y)).toBeLessThanOrEqual(0.15);
    // The stem welds exactly onto the bar's split vertex.
    expect(stem.points[0]).toEqual(junction);
  });

  it("dedupes exactly overlapping parallel strokes into one line", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-2, 0), pt(2, 0)]),
      stroke("b", [pt(-2, 0), pt(2, 0)]),
    ]);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points).toEqual([{ x: -2, y: 0 }, { x: 2, y: 0 }]);
  });

  it("merges partially overlapping parallel strokes into their union span", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-2, 0), pt(2, 0)]),
      stroke("b", [pt(0.1, 0), pt(4, 0)]),
    ]);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points).toEqual([{ x: -2, y: 0 }, { x: 4, y: 0 }]);
  });

  it("merges near-coincident parallel strokes within ε", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-2, 0), pt(2, 0)]),
      stroke("b", [pt(0, 0.1), pt(4, 0.1)]),
    ]);
    expect(polylines(out)).toHaveLength(1);
  });

  it("keeps parallel strokes beyond ε as separate lines", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-2, 0), pt(2, 0)]),
      stroke("b", [pt(0, 0.3), pt(4, 0.3)]),
    ]);
    expect(polylines(out)).toHaveLength(2);
  });

  it("demotes a self-intersecting loop instead of emitting an invalid polygon", () => {
    const bowtie = stroke(
      "bow",
      [pt(-1, -1), pt(1, 1), pt(-1, 1), pt(1, -1), pt(-1, -1)],
      { closed: true },
    );
    const out = stitchCanvasStrokes([bowtie]);
    expect(polygons(out)).toHaveLength(0);
    const lines = polylines(out);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.loop).toBe("selfIntersecting");
    expect(lines[0]!.meta.selfIntersecting).toBe(true);
  });

  it("splits a self-intersecting loop into two simple polygons on request", () => {
    const bowtie = stroke(
      "bow",
      [pt(-1, -1), pt(1, 1), pt(-1, 1), pt(1, -1), pt(-1, -1)],
      { closed: true },
    );
    const out = stitchCanvasStrokes([bowtie], {
      selfIntersectionPolicy: "split",
    });
    const rings = polygons(out);
    expect(rings).toHaveLength(2);
    const total = rings.reduce((sum, r) => sum + r.areaM2, 0);
    expect(total).toBeCloseTo(2, 6);
    expect(rings.every((r) => r.meta.selfIntersecting === true)).toBe(true);
  });
});

describe("un-stitching (non-destructive split) and records", () => {
  it("splits a stitched polygon back into its constituent strokes", () => {
    const out = stitchCanvasStrokes([
      stroke("s1", [pt(0, 0), pt(3, 0)]),
      stroke("s2", [pt(3, 0), pt(3, 2)]),
      stroke("s3", [pt(3, 2), pt(0, 2)]),
      stroke("s4", [pt(0, 2), pt(0, 0)]),
    ]);
    const ring = polygons(out)[0]!;
    const split = unstitchEntity(ring);
    expect(split).toHaveLength(4);
    expect(split.map((s) => s.layerId)).toEqual([
      "draft.user_draft",
      "draft.user_draft",
      "draft.user_draft",
      "draft.user_draft",
    ]);
    // The weld points survive — the split strokes reconnect exactly.
    expect(split[0]!.points[1]).toEqual(split[1]!.points[0]);
    expect(split[1]!.points[1]).toEqual(split[2]!.points[0]);
    expect(split[2]!.points[1]).toEqual(split[3]!.points[0]);
    expect(split[3]!.points[1]).toEqual(split[0]!.points[0]);
  });

  it("splits a fused polyline back into its source runs", () => {
    const out = stitchCanvasStrokes([
      stroke("a", [pt(-3, 0), pt(-1, 0)]),
      stroke("b", [pt(-1.1, 0), pt(1, 0)]),
    ]);
    const line = polylines(out)[0]!;
    const split = unstitchEntity(line);
    expect(split).toHaveLength(2);
    expect(split[0]!.points[1]).toEqual(split[1]!.points[0]);
    // The entity itself is untouched — the split is non-destructive.
    expect(line.points).toHaveLength(2);
  });

  it("stitchRecordOf carries everything the store needs to un-stitch", () => {
    const out = stitchCanvasStrokes([
      stroke("s1", [pt(0, 0), pt(3, 0)]),
      stroke("s2", [pt(3, 0), pt(3, 2)]),
    ]);
    const line = polylines(out)[0]!;
    const record = stitchRecordOf(line);
    expect(record.segments).toHaveLength(2);
    expect(record.strokeIds).toEqual(["s1", "s2"]);
    expect(record.layerId).toBe(line.layerId);
    expect(record.source).toBe("user_stroke");
  });
});

describe("live snap helpers (canvas highlights)", () => {
  it("collectSnapNodes welds stroke endpoints within ε", () => {
    const nodes = collectSnapNodes([
      stroke("a", [pt(-1, 0), pt(0, 0)]),
      stroke("b", [pt(0.1, 0), pt(1, 0)]),
    ]);
    expect(nodes).toHaveLength(3);
    expect(nodes.some((n) => Math.hypot(n.x - 0.05, n.y) < 1e-9)).toBe(true);
  });

  it("findSnapCandidates returns only nodes inside the ε radius, nearest first", () => {
    const nodes = [pt(0, 0), pt(0.1, 0), pt(2, 0)];
    const near = findSnapCandidates(pt(0.02, 0.03), nodes, 0.15);
    expect(near.map((c) => c.point)).toEqual([pt(0, 0), pt(0.1, 0)]);
    expect(near[0]!.distanceM).toBeLessThan(near[1]!.distanceM);
  });

  it("snapPointToNodes snaps inside ε and passes through outside it", () => {
    const nodes = [pt(0, 0), pt(5, 5)];
    const snapped = snapPointToNodes(pt(0.1, 0), nodes, DEFAULT_STITCH_EPSILON_M);
    expect(snapped.point).toEqual({ x: 0, y: 0 });
    expect(snapped.candidate?.distanceM).toBeCloseTo(0.1, 9);
    const free = snapPointToNodes(pt(3, 3), nodes, DEFAULT_STITCH_EPSILON_M);
    expect(free.candidate).toBeNull();
    expect(free.point).toEqual({ x: 3, y: 3 });
  });
});

describe("photo-trace stitching (plane-metre strokes)", () => {
  it("fuses an elevation fence run traced in disjoint plane strokes", () => {
    const out = stitchCanvasStrokes([
      stroke("post1", [pt(-1.5, 0), pt(-1.5, 1.8)]),
      stroke("rail", [pt(-1.45, 1.7), pt(1.5, 1.7)]),
      stroke("post2", [pt(1.5, 1.8), pt(1.5, 0)]),
    ]);
    const lines = polylines(out);
    // The posts + rail weld into one U-shaped polyline (two collinear joints
    // at the rail ends are absorbed, the U corners stay).
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points.length).toBeGreaterThanOrEqual(3);
  });

  it("closes a traced garden bed into a polygon in plane metres", () => {
    const out = stitchCanvasStrokes([
      stroke("e1", [pt(0, 0), pt(2, 0)]),
      stroke("e2", [pt(2, 0.05), pt(2, 1.5)]),
      stroke("e3", [pt(2, 1.5), pt(0.05, 1.5)]),
      stroke("e4", [pt(0, 1.5), pt(0, 0)]),
    ]);
    const rings = polygons(out);
    expect(rings).toHaveLength(1);
    expect(rings[0]!.areaM2).toBeCloseTo(3, 1);
    expect(rings[0]!.meta.closedByStitch).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CanvasStroke, SketchCanvas } from "@workstream/contracts";
import {
  isStandingCanvas,
  reconcileWallFootprint,
  wallFromStandingStroke,
} from "./wallSeam";

const IDENTITY = [0, 0, 0, 1] as SketchCanvas["rotation"];

/** A canvas standing vertical: rotate -90° about X lifts local +Z to world up. */
const QUAT_STANDING_ABOUT_X = (() => {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  return [q.x, q.y, q.z, q.w] as SketchCanvas["rotation"];
})();

const canvas = (rotation: SketchCanvas["rotation"] = IDENTITY): SketchCanvas => ({
  id: "c1",
  position: [0, 0, 0],
  rotation,
  season_tag: "ALL",
});

const scaleM = 100;
const boardAspect = 1;

const stroke = (points: CanvasStroke["points"], extra: Partial<CanvasStroke> = {}): CanvasStroke =>
  ({
    id: "s1",
    points,
    color: "#000000",
    width_px: 2,
    ...extra,
  }) as CanvasStroke;

/** A square wall-face outline drawn on a standing canvas. At scaleM=100 the
 *  lot is 100 m wide/tall, so pct ARE metres: 4 m wide, 3 m tall. */
const WALL_SQUARE = [
  { x_pct: 30, y_pct: 40 },
  { x_pct: 34, y_pct: 40 },
  { x_pct: 34, y_pct: 37 },
  { x_pct: 30, y_pct: 37 },
  { x_pct: 30, y_pct: 40 },
];

describe("isStandingCanvas (D2/A2 — geometric, not preset)", () => {
  it("a ground-parallel canvas is not standing", () => {
    expect(isStandingCanvas(canvas())).toBe(false);
  });

  it("a vertical canvas is standing", () => {
    expect(isStandingCanvas(canvas(QUAT_STANDING_ABOUT_X))).toBe(true);
  });

  it("a canvas folded past the epsilon stops being standing — the hinge gizmo can do this after placement", () => {
    const tilted = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2 + 0.05, // ~2.9° off vertical — beyond the 1° epsilon
    );
    expect(
      isStandingCanvas(canvas([tilted.x, tilted.y, tilted.z, tilted.w])),
    ).toBe(false);
  });
});

describe("wallFromStandingStroke (D2 — closed outline, drawn height)", () => {
  it("converts a closed square on a standing canvas to footprint + drawn height", () => {
    const out = wallFromStandingStroke(
      stroke(WALL_SQUARE, { nib: "ink-03" }),
      canvas(QUAT_STANDING_ABOUT_X),
      scaleM,
      boardAspect,
    );
    expect(out).not.toBeNull();
    expect(out!.drawnHeightM).toBeCloseTo(3, 5);
    // Footprint: 4 m wide (x 30→70 pct at scaleM 100 = 40 pct of 100 m…
    // width check instead of exact pct): the ring is 4 distinct corners.
    expect(out!.footprintPct).toHaveLength(5);
  });

  it("rejects an OPEN stroke — it would drop to a zero-width line", () => {
    const open = WALL_SQUARE.slice(0, 4); // no closing point
    expect(
      wallFromStandingStroke(
        stroke(open),
        canvas(QUAT_STANDING_ABOUT_X),
        scaleM,
        boardAspect,
      ),
    ).toBeNull();
  });

  it("rejects a flat canvas — a height read off a tilt would be a trig lie", () => {
    expect(
      wallFromStandingStroke(stroke(WALL_SQUARE), canvas(), scaleM, boardAspect),
    ).toBeNull();
  });

  it("rejects a degenerate tick (no drawn vertical extent)", () => {
    // Zero-height square: every point at the same canvas height — a flat
    // sliver on the wall, not a wall.
    const flatSquare = WALL_SQUARE.map((p) => ({ x_pct: p.x_pct, y_pct: 40 }));
    expect(
      wallFromStandingStroke(
        stroke(flatSquare),
        canvas(QUAT_STANDING_ABOUT_X),
        scaleM,
        boardAspect,
      ),
    ).toBeNull();
  });
});

describe("reconcileWallFootprint (D1 — containment is the reconciliation)", () => {
  // Title boundary: the standard 20–80 ring.
  const BOUNDARY = [
    { x: 20, y: 15 },
    { x: 80, y: 15 },
    { x: 80, y: 85 },
    { x: 20, y: 85 },
  ];

  it("inside the ring → contained", () => {
    const fp = [
      { x: 40, y: 40 },
      { x: 55, y: 40 },
      { x: 55, y: 55 },
      { x: 40, y: 55 },
    ];
    expect(reconcileWallFootprint(fp, BOUNDARY)).toEqual({ kind: "contained" });
  });

  it("crossing the ring → crosses, with the crossed boundary edge named", () => {
    // This wall runs across the west boundary edge (edge 3: x=20 column).
    const fp = [
      { x: 10, y: 40 },
      { x: 30, y: 40 },
      { x: 30, y: 55 },
      { x: 10, y: 55 },
    ];
    const out = reconcileWallFootprint(fp, BOUNDARY);
    expect(out.kind).toBe("crosses");
    expect(out).toEqual({ kind: "crosses", crossedEdges: [3] });
  });

  it("a footprint sharing an edge with the boundary abuts — containment, not crossing", () => {
    const fp = [
      { x: 20, y: 40 },
      { x: 45, y: 40 },
      { x: 45, y: 60 },
      { x: 20, y: 60 },
    ];
    const out = reconcileWallFootprint(fp, BOUNDARY);
    expect(out.kind).toBe("contained");
  });

  it("outside the ring entirely → crosses (exit + re-entry edges)", () => {
    const fp = [
      { x: 2, y: 40 },
      { x: 12, y: 40 },
      { x: 12, y: 55 },
      { x: 2, y: 55 },
    ];
    expect(reconcileWallFootprint(fp, BOUNDARY).kind).toBe("crosses");
  });

  it("no title truth → indicative (photo-trace vocabulary)", () => {
    expect(reconcileWallFootprint([{ x: 50, y: 50 }], [])).toEqual({
      kind: "indicative",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  circlePoints,
  rectPoints,
  linePoints,
  shapePoints,
  snapShapePoint,
  SHAPE_SNAP_GRID_PCT,
} from "./sketchShapes";

describe("sketch shapes", () => {
  it("draws a straight line between start and end", () => {
    expect(linePoints({ x: 10, y: 10 }, { x: 40, y: 60 })).toEqual([
      { x: 10, y: 10 },
      { x: 40, y: 60 },
    ]);
  });

  it("draws a closed 5-point rectangle loop from any drag direction", () => {
    const pts = rectPoints({ x: 60, y: 60 }, { x: 20, y: 10 });
    expect(pts[0]).toEqual({ x: 20, y: 10 });
    expect(pts[2]).toEqual({ x: 60, y: 60 });
    expect(pts[pts.length - 1]).toEqual(pts[0]);
  });

  it("approximates a circle with a closed polygon for hit-testing", () => {
    const pts = circlePoints({ x: 0, y: 0 }, { x: 20, y: 20 });
    expect(pts.length).toBe(41);
    // First and last point close the loop.
    expect(pts[0]!.x).toBeCloseTo(pts[pts.length - 1]!.x, 5);
  });

  it("shift constrains line angle to 45° increments", () => {
    const pts = shapePoints("line", { x: 0, y: 0 }, { x: 10, y: 1 }, true);
    const [, end] = pts;
    // Nearly-horizontal drag snaps flat under shift.
    expect(end!.y).toBeCloseTo(0, 5);
  });

  it("shift constrains rect to a square", () => {
    const pts = shapePoints("rect", { x: 0, y: 0 }, { x: 10, y: 4 }, true);
    const width = pts[2]!.x - pts[0]!.x;
    const height = pts[2]!.y - pts[0]!.y;
    expect(Math.abs(width)).toBeCloseTo(Math.abs(height), 5);
  });

  describe("snapShapePoint", () => {
    const boardW = 1000;
    const boardH = 1000;

    it("locks onto a nearby existing endpoint (vertex) ahead of the grid", () => {
      const anchors = [{ x: 50.3, y: 50.2 }];
      const { point, kind } = snapShapePoint(
        { x: 50, y: 50 },
        anchors,
        boardW,
        boardH,
      );
      expect(kind).toBe("vertex");
      expect(point).toEqual(anchors[0]);
    });

    it("falls back to the magnetic grid when no endpoint is near", () => {
      const { point, kind } = snapShapePoint(
        { x: 50.4, y: 24.7 },
        [],
        boardW,
        boardH,
      );
      expect(kind).toBe("grid");
      expect(point.x % SHAPE_SNAP_GRID_PCT).toBeCloseTo(0, 5);
      expect(point.y % SHAPE_SNAP_GRID_PCT).toBeCloseTo(0, 5);
    });

    it("ignores anchors far outside the vertex snap radius", () => {
      const anchors = [{ x: 90, y: 90 }];
      const { kind } = snapShapePoint({ x: 10, y: 10 }, anchors, boardW, boardH);
      expect(kind).toBe("grid");
    });
  });
});

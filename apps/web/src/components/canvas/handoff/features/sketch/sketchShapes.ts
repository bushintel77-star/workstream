import type { PctPoint } from "../../geometry";
import { GRID_STEP_PCT, snapToGridPct, snapVertexDrag } from "../../geometry/snap";

/**
 * Shape generators — produce point arrays for the line/rect/circle tools.
 * The crisp on-screen render (SketchBoard, FreehandLayer) draws these as
 * plain SVG `<line>`/`<rect>`/`<ellipse>` geometry, deliberately distinct
 * from the organic perfect-freehand ink strokes. `shapePoints` output still
 * backs eraser hit-testing and the AI-vision raster capture, where a
 * polyline/polygon approximation is all that's needed.
 */

/** Straight line: start to end. */
export function linePoints(start: PctPoint, end: PctPoint): PctPoint[] {
  return [start, end];
}

/** Rectangle: 5 points (closed loop). */
export function rectPoints(start: PctPoint, end: PctPoint): PctPoint[] {
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const x2 = Math.max(start.x, end.x);
  const y2 = Math.max(start.y, end.y);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
    { x: x1, y: y1 },
  ];
}

/**
 * Circle: ~40 points around the circumference, derived from bounding box.
 * Only used for hit-testing / raster capture now — the on-screen render is
 * a true SVG `<ellipse>` (see SketchBoard / FreehandLayer), so faceting from
 * this polygon approximation is never visible to the user.
 */
export function circlePoints(start: PctPoint, end: PctPoint): PctPoint[] {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  if (rx < 0.1 || ry < 0.1) return [start, end];
  const segments = 40;
  const points: PctPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Constrain a point to the nearest 0/45/90° angle from start.
 * Universal in professional drawing tools (Illustrator, Figma, AutoCAD).
 */
function constrainAngle(start: PctPoint, end: PctPoint): PctPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const dist = Math.hypot(dx, dy);
  // Snap to nearest 45° increment
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: start.x + dist * Math.cos(snapped),
    y: start.y + dist * Math.sin(snapped),
  };
}

/** Constrain a bounding box to a square (equal width/height). */
function constrainSquare(start: PctPoint, end: PctPoint): PctPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx || 1) * size,
    y: start.y + Math.sign(dy || 1) * size,
  };
}

/**
 * Snap radius for shape-tool endpoints, in CSS px — matches the CAD board's
 * vertex snap radius (SDS §3 = 12) so the two tools feel identical.
 */
const SHAPE_SNAP_VERTEX_PX = 10;

/** Magnetic grid step for shape drafting — reuses the CAD "fine" grain. */
export const SHAPE_SNAP_GRID_PCT = GRID_STEP_PCT.fine;

export type ShapeSnapKind = "vertex" | "grid";

/**
 * Snap a raw shape-tool endpoint to nearby stroke endpoints first (CAD-style
 * vertex lock), else to the magnetic drafting grid. Ambient, not modal — the
 * caller skips this while Shift is held so the explicit angle/square
 * constraint always wins over passive magnetism.
 */
export function snapShapePoint(
  raw: PctPoint,
  anchors: PctPoint[],
  boardW: number,
  boardH: number,
  gridStepPct: number = SHAPE_SNAP_GRID_PCT,
): { point: PctPoint; kind: ShapeSnapKind } {
  const vertex = snapVertexDrag(raw, anchors, {
    boardW,
    boardH,
    vertexPx: SHAPE_SNAP_VERTEX_PX,
    // shift:true here only disables snapVertexDrag's internal axis-lock
    // sweep — it still runs the nearest-anchor distance check we want.
    shift: true,
  });
  if (vertex.kind === "vertex") {
    return { point: { x: vertex.x, y: vertex.y }, kind: "vertex" };
  }
  return { point: snapToGridPct(raw, gridStepPct), kind: "grid" };
}

/**
 * The actual end point a shape tool will draw to, after Shift constraints
 * (45°/ortho for line, square for rect/circle). Shared by `shapePoints`
 * (legacy points array) and the crisp-geometry renderer (SketchBoard /
 * FreehandLayer), so both always agree on where the shape actually ends.
 */
export function constrainedShapeEnd(
  shape: "line" | "rect" | "circle",
  start: PctPoint,
  end: PctPoint,
  shiftHeld = false,
): PctPoint {
  if (!shiftHeld) return end;
  return shape === "line" ? constrainAngle(start, end) : constrainSquare(start, end);
}

/** Generate shape points based on the active shape tool. */
export function shapePoints(
  shape: "line" | "rect" | "circle",
  start: PctPoint,
  end: PctPoint,
  shiftHeld = false,
): PctPoint[] {
  const e = constrainedShapeEnd(shape, start, end, shiftHeld);
  if (shape === "line") return linePoints(start, e);
  if (shape === "rect") return rectPoints(start, e);
  return circlePoints(start, e);
}

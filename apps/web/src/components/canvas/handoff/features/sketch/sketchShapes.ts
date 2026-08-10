import type { PctPoint } from "../../geometry";

/**
 * Shape generators — produce point arrays that render through the same
 * perfect-freehand pipeline as pen strokes. Shapes look hand-drawn, not
 * CAD-precise, matching the sketch aesthetic.
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

/** Circle: ~40 points around the circumference, derived from bounding box. */
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

/** Generate shape points based on the active shape tool. */
export function shapePoints(
  shape: "line" | "rect" | "circle",
  start: PctPoint,
  end: PctPoint,
  shiftHeld = false,
): PctPoint[] {
  if (shape === "line") {
    const e = shiftHeld ? constrainAngle(start, end) : end;
    return linePoints(start, e);
  }
  if (shape === "rect") {
    const e = shiftHeld ? constrainSquare(start, end) : end;
    return rectPoints(start, e);
  }
  // Circle — Shift makes it a perfect circle (equal rx/ry)
  if (shiftHeld) {
    const e = constrainSquare(start, end);
    return circlePoints(start, e);
  }
  return circlePoints(start, end);
}

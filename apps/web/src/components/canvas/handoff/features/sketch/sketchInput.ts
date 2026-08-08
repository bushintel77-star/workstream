import type { PctPoint } from "../../geometry";
import type { SketchStroke } from "../../studioCatalog";
import {
  SKETCH_TIP_BAND,
  type SketchTipGrade,
} from "./sketchCursors";

export const MIN_SKETCH_POINT_DISTANCE_PCT = 0.38;

export function shouldAppendSketchPoint(
  previous: PctPoint,
  next: PctPoint,
  minimumDistancePct = MIN_SKETCH_POINT_DISTANCE_PCT,
): boolean {
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= minimumDistancePct;
}

/**
 * Graded marker tip — Fine stays a hairline nib; Marker opens to a thick felt.
 * Stylus pressure walks the chosen tip band; mouse/touch sits mid-band
 * (touch slightly heavier for finger ink).
 */
export function sketchWidthForPointer(
  pointerType: string,
  averagePressure: number | null,
  tip: SketchTipGrade = "medium",
): number {
  const { min, max } = SKETCH_TIP_BAND[tip];
  if (pointerType === "pen" && averagePressure != null) {
    const pressure = Math.max(0, Math.min(1, averagePressure));
    return +(min + pressure * (max - min)).toFixed(2);
  }
  const mid = min + (max - min) * (pointerType === "touch" ? 0.55 : 0.35);
  return +mid.toFixed(2);
}

function distanceToSegmentPx(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-8) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Return the top-most whole stroke under an eraser point. */
export function findSketchStrokeAtPoint(
  strokes: SketchStroke[],
  point: PctPoint,
  widthPx: number,
  heightPx: number,
  thresholdPx = 14,
): string | null {
  const target = {
    x: (point.x / 100) * widthPx,
    y: (point.y / 100) * heightPx,
  };
  for (let strokeIndex = strokes.length - 1; strokeIndex >= 0; strokeIndex--) {
    const stroke = strokes[strokeIndex]!;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1]!;
      const b = stroke.points[i]!;
      const distance = distanceToSegmentPx(
        target,
        { x: (a.x / 100) * widthPx, y: (a.y / 100) * heightPx },
        { x: (b.x / 100) * widthPx, y: (b.y / 100) * heightPx },
      );
      if (distance <= thresholdPx) return stroke.id;
    }
  }
  return null;
}

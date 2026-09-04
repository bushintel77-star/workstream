import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import {
  buildLandscapeFeatureFromStroke,
  type StructuredToolKind,
} from "./structured-tools";

export type StrokeRecognition = {
  kind: StructuredToolKind;
  confidence: number;
  reason: string;
};

function polylineLength(
  pts: Array<{ x_pct: number; y_pct: number }>,
): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(
      pts[i]!.x_pct - pts[i - 1]!.x_pct,
      pts[i]!.y_pct - pts[i - 1]!.y_pct,
    );
  }
  return len;
}

function closureGap(
  pts: Array<{ x_pct: number; y_pct: number }>,
): number {
  if (pts.length < 2) return Number.POSITIVE_INFINITY;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  return Math.hypot(a.x_pct - b.x_pct, a.y_pct - b.y_pct);
}

function straightness(
  pts: Array<{ x_pct: number; y_pct: number }>,
): number {
  if (pts.length < 2) return 0;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const chord = Math.hypot(a.x_pct - b.x_pct, a.y_pct - b.y_pct);
  const path = polylineLength(pts);
  if (path <= 0) return 0;
  return chord / path;
}

/** Classify a freehand stroke as ditch / path / wall / bed. */
export function recognizeStroke(stroke: CanvasStroke): StrokeRecognition | null {
  const pts = stroke.points;
  if (pts.length < 2) return null;
  const len = polylineLength(pts);
  if (len < 2) return null;
  const gap = closureGap(pts);
  const straight = straightness(pts);
  const thick = stroke.width_px >= 4;

  if (pts.length >= 4 && gap < Math.max(4, len * 0.18)) {
    return {
      kind: "bed",
      confidence: 0.72,
      reason: "Closed loop — planting bed",
    };
  }
  if (thick && straight > 0.88 && len < 35) {
    return {
      kind: "wall",
      confidence: 0.7,
      reason: "Short thick stroke — wall",
    };
  }
  if (straight > 0.9 && stroke.width_px <= 2.5) {
    return {
      kind: "ditch",
      confidence: 0.65,
      reason: "Thin straight stroke — ditch / drain",
    };
  }
  if (straight > 0.75 || len > 8) {
    return {
      kind: "path",
      confidence: 0.6,
      reason: "Open stroke — path",
    };
  }
  return null;
}

export function featureFromRecognizedStroke(
  stroke: CanvasStroke,
  recognition: StrokeRecognition,
  idFactory: () => string = () => crypto.randomUUID(),
  planeZ?: number,
): LandscapeFeature {
  return buildLandscapeFeatureFromStroke({
    kind: recognition.kind,
    points: stroke.points,
    id: idFactory(),
    planeZ,
  });
}

/**
 * Sketch Pad helpers — stroke capture, snap-close, area/cost calc, history.
 *
 * Reuses the existing CanvasStroke schema (packages/contracts) + freehandPath
 * (perfect-freehand) + polygonAreaM2 (handoff geometry). These helpers are
 * pure functions + a lightweight history hook — no React rendering here.
 */

import { useCallback, useRef, useState } from "react";
import type { CanvasStroke } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { polygonAreaM2 } from "../handoff/geometry/polygon";
import type { PctPoint } from "../handoff/geometry/types";

export type { PctPoint };

export type SketchTool = "grid" | "draw" | "node";

/** Which plane the canvas is sketching on — drives the grid + chip math. */
export type SketchView = "plan" | "elevation";

/** Default freehand stroke color (magenta ink — high contrast over aerial). */
export const STROKE_COLOR = PALETTE.sketchInk;
export const STROKE_WIDTH = 2.5;

/**
 * Snap threshold in board-% — if the last point of a stroke lands within this
 * distance of the first point, the loop auto-closes (the "auto-snapping"
 * gesture from the brief).
 */
export const SNAP_CLOSE_PCT = 3.5;

/** Rough cost-per-m² heuristic for the live cost-bracket chip. */
const RATE_PER_M2 = 300;

/** Distance between two % points (Euclidean, board space). */
export function pctDist(a: PctPoint, b: PctPoint): number {
  return Math.hypot(a.x - b.x, b.y - b.y);
}

/**
 * Should this stroke auto-close? True if the last point is within SNAP_CLOSE_PCT
 * of the first point and there are enough points to form a polygon (≥3).
 */
export function shouldSnapClose(points: PctPoint[]): boolean {
  if (points.length < 4) return false;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return pctDist(first, last) < SNAP_CLOSE_PCT;
}

/**
 * Compute live area (m²) + cost bracket from a stroke's points. Uses
 * polygonAreaM2 from the handoff geometry lib (same calc the CAD board uses).
 * Returns null if the stroke isn't closed/closable (< 3 points).
 */
export function strokeAreaAndCost(
  points: PctPoint[],
  scaleM: number,
  boardAspect: number,
): { areaM2: number; costLow: number; costHigh: number } | null {
  if (points.length < 3) return null;
  const areaM2 = polygonAreaM2(points, scaleM, boardAspect);
  if (areaM2 <= 0) return null;
  const cost = areaM2 * RATE_PER_M2;
  // ±15% bracket — communicates "indicative estimate, not a quote".
  return {
    areaM2: Math.round(areaM2),
    costLow: Math.round((cost * 0.85) / 1000) * 1000,
    costHigh: Math.round((cost * 1.15) / 1000) * 1000,
  };
}

/** Format a cost bracket as "$Xk – $Yk". */
export function formatCostBracket(low: number, high: number): string {
  const fmt = (v: number) => `$${Math.round(v / 1000)}k`;
  return `${fmt(low)} – ${fmt(high)}`;
}

/**
 * Elevation-mode metric — measure the vertical height of a stroke in metres.
 * In elevation view, board-% Y maps to real height via the same scaleM/100
 * conversion, but against a ceiling (the plot height in metres, default 8m
 * for a typical residential elevation). The stroke's Y-extent (min→max)
 * gives the drawn height.
 */
export function strokeHeightM(
  points: PctPoint[],
  scaleM: number,
  ceilingM = 8,
): { heightM: number; groundToTopM: number } | null {
  if (points.length < 2) return null;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys); // top of the stroke (SVG Y is down, so min = highest)
  const maxY = Math.max(...ys); // bottom (nearest ground line)
  // Convert the Y-span from board-% to metres against the ceiling.
  const spanPct = maxY - minY;
  if (spanPct <= 0) return null;
  const heightM = Math.round(((spanPct / 100) * ceilingM) * 10) / 10;
  // Ground-to-top: distance from the ground line (Y=100 in plan, but in
  // elevation the ground is typically at ~80% down the viewBox). We measure
  // from the stroke's top to the ground.
  const groundToTopM = Math.round((((100 - minY) / 100) * ceilingM) * 10) / 10;
  return { heightM, groundToTopM };
}

/**
 * Plan-mode perimeter — the total outline length of a closed stroke in metres.
 */
export function strokePerimeterM(
  points: PctPoint[],
  scaleM: number,
  boardAspect = 1,
): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dxM = ((b.x - a.x) / 100) * scaleM;
    const dyM = ((b.y - a.y) / 100) * scaleM * boardAspect;
    sum += Math.hypot(dxM, dyM);
  }
  return Math.round(sum);
}

/**
 * Convert a DOM pointer event on the SVG surface to a board-% point.
 * The SVG uses viewBox="0 0 100 100" preserveAspectRatio="none", so %
 * = (clientX - rectLeft) / rectWidth * 100, same for Y.
 */
export function pointerToPct(
  e: { clientX: number; clientY: number },
  rect: DOMRect,
): PctPoint {
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
}

/** Create a new CanvasStroke from raw points. */
export function makeStroke(
  points: PctPoint[],
  overrides?: Partial<CanvasStroke>,
): CanvasStroke {
  return {
    id: crypto.randomUUID(),
    points: points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    color: STROKE_COLOR,
    width_px: STROKE_WIDTH,
    kind: "ink",
    ...overrides,
  };
}

/**
 * Lightweight undo/redo history hook. Stores snapshots of the stroke array
 * (shallow-copied). Each commit pushes the previous state; undo/redo move
 * a pointer. Simpler than the full useStudioState reducer — the sketch pad
 * is standalone.
 */
export function useSketchHistory(initial: CanvasStroke[]) {
  const [strokes, setStrokes] = useState<CanvasStroke[]>(initial);
  const past = useRef<CanvasStroke[][]>([]);
  const future = useRef<CanvasStroke[][]>([]);

  const commit = useCallback((next: CanvasStroke[]) => {
    past.current.push(strokes);
    future.current = [];
    setStrokes(next);
  }, [strokes]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(strokes);
    setStrokes(prev);
  }, [strokes]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(strokes);
    setStrokes(next);
  }, [strokes]);

  return {
    strokes,
    setStrokes: commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/** Convert CanvasStroke points (x_pct/y_pct) to PctPoint[] for geometry calcs. */
export function strokeToPctPoints(s: CanvasStroke): PctPoint[] {
  return s.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
}

import type { PctPoint } from "./types";
import { toBoardPctPoint } from "./boardPct";
import { ZOOM_MIN } from "./canvasZoom";

export type SnapKind = "close" | "vertex" | "angle" | "ortho" | null;

export type SnapResult = PctPoint & {
  kind: SnapKind;
  /** Anchor used for angle/ortho rubber-band (last poly point). */
  from?: PctPoint;
};

export type SnapOptions = {
  /** Board width in CSS px — used to convert pixel thresholds to %. */
  boardW: number;
  boardH: number;
  /** Closing ring radius in CSS px (handoff ≈ 14). */
  closePx?: number;
  /** Vertex / cadastral snap radius in CSS px (SDS §3 = 12). */
  vertexPx?: number;
  /** Soft angle snap tolerance in radians when Shift is not held. */
  softAngleRad?: number;
  /** Hold Shift for strict ortho (90°); otherwise prefer 45° soft snap. */
  shift?: boolean;
};

function pctDistPx(
  a: PctPoint,
  b: PctPoint,
  boardW: number,
  boardH: number,
): number {
  return Math.hypot(((b.x - a.x) / 100) * boardW, ((b.y - a.y) / 100) * boardH);
}

/**
 * AutoCAD-style pointer snap for in-progress polygon tracing.
 * Priority: close-to-first → existing vertex → angle/ortho from last point.
 */
export function snapTracePointer(
  raw: PctPoint,
  drawPoly: PctPoint[],
  anchors: PctPoint[],
  opts: SnapOptions,
): SnapResult {
  const boardW = Math.max(1, opts.boardW);
  const boardH = Math.max(1, opts.boardH);
  const closePx = opts.closePx ?? 14;
  const vertexPx = opts.vertexPx ?? 12;
  const soft = opts.softAngleRad ?? 0.09;
  const shift = Boolean(opts.shift);

  if (drawPoly.length >= 3) {
    const first = drawPoly[0]!;
    if (pctDistPx(raw, first, boardW, boardH) < closePx) {
      return { x: first.x, y: first.y, kind: "close" };
    }
  }

  let best: PctPoint | null = null;
  let bestD = vertexPx;
  for (const v of anchors) {
    const d = pctDistPx(raw, v, boardW, boardH);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best) {
    return { x: best.x, y: best.y, kind: "vertex" };
  }

  if (drawPoly.length > 0) {
    const last = drawPoly[drawPoly.length - 1]!;
    const dxPx = ((raw.x - last.x) / 100) * boardW;
    const dyPx = ((raw.y - last.y) / 100) * boardH;
    const len = Math.hypot(dxPx, dyPx);
    if (len > 2) {
      const a = Math.atan2(dyPx, dxPx);
      const step = shift ? Math.PI / 2 : Math.PI / 4;
      const sa = Math.round(a / step) * step;
      if (shift || Math.abs(a - sa) < soft) {
        const nx = last.x + ((len * Math.cos(sa)) / boardW) * 100;
        const ny = last.y + ((len * Math.sin(sa)) / boardH) * 100;
        const snapped = toBoardPctPoint({ x: nx, y: ny });
        return {
          ...snapped,
          kind: shift ? "ortho" : "angle",
          from: last,
        };
      }
    }
  }

  return { ...toBoardPctPoint(raw), kind: null };
}

/**
 * While dragging a polygon vertex, snap to nearby vertices (excluding self)
 * and optionally lock X/Y to neighbours for ortho editing.
 */
export function snapVertexDrag(
  raw: PctPoint,
  anchors: PctPoint[],
  opts: {
    boardW: number;
    boardH: number;
    exclude?: PctPoint;
    vertexPx?: number;
    axisPx?: number;
    shift?: boolean;
  },
): SnapResult {
  const boardW = Math.max(1, opts.boardW);
  const boardH = Math.max(1, opts.boardH);
  const vertexPx = opts.vertexPx ?? 12;
  const axisPx = opts.axisPx ?? 7;
  let x = raw.x;
  let y = raw.y;
  let kind: SnapKind = null;

  if (!opts.shift) {
    for (const v of anchors) {
      if (
        opts.exclude &&
        Math.abs(v.x - opts.exclude.x) < 1e-6 &&
        Math.abs(v.y - opts.exclude.y) < 1e-6
      ) {
        continue;
      }
      if (Math.abs(((x - v.x) / 100) * boardW) < axisPx) {
        x = v.x;
        kind = "ortho";
      }
      if (Math.abs(((y - v.y) / 100) * boardH) < axisPx) {
        y = v.y;
        kind = "ortho";
      }
    }
  }

  let best: PctPoint | null = null;
  let bestD = vertexPx;
  for (const v of anchors) {
    if (
      opts.exclude &&
      Math.abs(v.x - opts.exclude.x) < 1e-6 &&
      Math.abs(v.y - opts.exclude.y) < 1e-6
    ) {
      continue;
    }
    const d = pctDistPx({ x, y }, v, boardW, boardH);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best) {
    return { x: best.x, y: best.y, kind: "vertex" };
  }

  return { ...toBoardPctPoint({ x, y }), kind };
}

/** Alignment guides while dragging a free symbol against other items. */
export function snapAlignment(
  target: PctPoint,
  others: PctPoint[],
  threshPct = 1.3,
): { point: PctPoint; guideX: number | null; guideY: number | null } {
  let gx: number | null = null;
  let gy: number | null = null;
  for (const o of others) {
    if (gx == null && Math.abs(o.x - target.x) < threshPct) gx = o.x;
    if (gy == null && Math.abs(o.y - target.y) < threshPct) gy = o.y;
  }
  return {
    point: {
      x: gx ?? target.x,
      y: gy ?? target.y,
    },
    guideX: gx,
    guideY: gy,
  };
}

/** Drafting grid grain — % of board width/height per cell. */
export type GridGrain = "fine" | "medium" | "coarse";

export const GRID_STEP_PCT: Record<GridGrain, number> = {
  fine: 1,
  medium: 2.5,
  coarse: 5,
};

/** Snap a %-coord to the drafting grid. */
export function snapToGridPct(
  target: PctPoint,
  stepPct: number,
): PctPoint {
  const step = Math.max(0.25, stepPct);
  return toBoardPctPoint({
    x: Math.round(target.x / step) * step,
    y: Math.round(target.y / step) * step,
  });
}

/** Working precision for metre-space grid snap (Phase 1). */
export const GRID_SIZE_M = 0.5;

/** Screen-space snap radius — divide by planZoom for world radius. */
export const SNAP_RADIUS_PX = 10;

/** Convert a metre grid to board % for the current scale. */
export function metresGridStepPct(
  scaleM: number,
  gridM: number = GRID_SIZE_M,
): number {
  return (Math.max(1e-6, gridM) / Math.max(1e-6, scaleM)) * 100;
}

/** Half-metre (or custom) grid in calibrated board metres → % coords. */
export function snapToGridMetres(
  target: PctPoint,
  scaleM: number,
  gridM: number = GRID_SIZE_M,
): PctPoint {
  return snapToGridPct(target, metresGridStepPct(scaleM, gridM));
}

/**
 * Vertex/edge snap in screen px (zoom-aware), else fall back to metre grid.
 * `planZoom` is the camera scale on `.zoomWorld`.
 */
export function snapToNearby(
  point: PctPoint,
  candidates: PctPoint[],
  args: {
    planZoom: number;
    boardW: number;
    boardH: number;
    scaleM: number;
    snapRadiusPx?: number;
    gridM?: number;
  },
): PctPoint {
  const zoom = Math.max(ZOOM_MIN, args.planZoom || 1);
  const radiusWorldPx =
    (args.snapRadiusPx ?? SNAP_RADIUS_PX) / zoom;
  let best: PctPoint | null = null;
  let bestD = radiusWorldPx;
  for (const c of candidates) {
    const d = pctDistPx(point, c, args.boardW, args.boardH);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) return { x: best.x, y: best.y };
  return snapToGridMetres(point, args.scaleM, args.gridM);
}

/**
 * Clock-face rotation snap (30° = hour marks).
 * Shift → 15° half-hours; Alt → free angle.
 */
export function snapClockRotationDeg(
  angleDeg: number,
  opts?: { shift?: boolean; alt?: boolean },
): number {
  let a = angleDeg % 360;
  if (a < 0) a += 360;
  if (opts?.alt) return a;
  const step = opts?.shift ? 15 : 30;
  return Math.round(a / step) * step;
}

/**
 * Grid first (magnetic draft), then soft alignment to peers.
 * Returns crosshair anchors for full-canvas guides.
 */
export function snapDraftPoint(
  target: PctPoint,
  others: PctPoint[],
  stepPct: number,
  alignThreshPct = 1.3,
): {
  point: PctPoint;
  guideX: number | null;
  guideY: number | null;
  crossX: number;
  crossY: number;
} {
  const gridded = snapToGridPct(target, stepPct);
  const aligned = snapAlignment(gridded, others, alignThreshPct);
  return {
    point: aligned.point,
    guideX: aligned.guideX,
    guideY: aligned.guideY,
    crossX: aligned.point.x,
    crossY: aligned.point.y,
  };
}

/**
 * Hybrid plane helpers — every studio shape tracks two localized planes:
 *   • canvas % (x/y) for 60 FPS viewport rendering / zoom
 *   • physical metres from local origin (0,0) = board / site corner
 *
 * Workflow 1 status (locked): StudioItem + these helpers ARE the dual-plane
 * model. DesignCanvas.features / LandscapeFeature remain optional Stage-2
 * persistence — do not migrate the live handoff path without a schema brief.
 */

/**
 * Unbounded canvas point, matching the contract's `CanvasPointPct`.
 * `localMToPct` is a pure inverse of `pctToLocalM`, so metres past the board
 * edge come back as percents past 0-100. It is deliberately NOT the
 * board-bounded `BoardPointPct` — do not rename it toward that, and do not feed
 * it to a bounded slot without `toBoardPoint`.
 */
export type CanvasPointPct = { x_pct: number; y_pct: number };
export type LocalMetrePoint = { x_m: number; y_m: number };

export type HybridPlaneMetrics = {
  canvas: {
    x_pct: number;
    y_pct: number;
    w_pct: number;
    h_pct: number;
  };
  physical: {
    origin_m: LocalMetrePoint;
    width_m: number;
    height_m: number;
    area_m2: number;
    perimeter_m: number;
  };
};

/** Board-% point → local metres (origin at board 0,0). */
export function pctToLocalM(
  xPct: number,
  yPct: number,
  scaleM: number,
  boardAspect = 1,
): LocalMetrePoint {
  return {
    x_m: (xPct / 100) * scaleM,
    y_m: (yPct / 100) * (scaleM / boardAspect),
  };
}

/** Local metres → board-% (inverse of pctToLocalM). */
export function localMToPct(
  xM: number,
  yM: number,
  scaleM: number,
  boardAspect = 1,
): CanvasPointPct {
  return {
    x_pct: scaleM > 0 ? (xM / scaleM) * 100 : 0,
    y_pct: scaleM > 0 ? (yM / (scaleM / boardAspect)) * 100 : 0,
  };
}

/**
 * Studio item footprint in metres from the legacy wPx/hPx × scale convention
 * (40 px ≈ 1 m at scale 1 — matches estimateStudioDrawing / BY_TYPE).
 */
export function itemFootprintMetres(args: {
  wPx: number;
  hPx: number;
  scale: number;
  areaKind?: "rect" | "ellipse" | "none";
  linear?: boolean;
}): { width_m: number; height_m: number; area_m2: number; perimeter_m: number } {
  const width_m = (args.wPx * args.scale) / 40;
  const height_m = (args.hPx * args.scale) / 40;
  const kind = args.areaKind ?? "rect";

  if (args.linear) {
    const length_m = Math.max(width_m, height_m);
    return {
      width_m,
      height_m,
      area_m2: length_m * 0.35,
      perimeter_m: length_m,
    };
  }

  if (kind === "ellipse") {
    const a = width_m / 2;
    const b = height_m / 2;
    // Ramanujan approximation for ellipse perimeter
    const perimeter_m =
      Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    return {
      width_m,
      height_m,
      area_m2: (Math.PI / 4) * width_m * height_m,
      perimeter_m,
    };
  }

  if (kind === "none") {
    return { width_m, height_m, area_m2: 0, perimeter_m: 0 };
  }

  return {
    width_m,
    height_m,
    area_m2: width_m * height_m,
    perimeter_m: 2 * (width_m + height_m),
  };
}

/** Axis-aligned footprint ring in local metres, centred on item origin. */
export function itemFootprintRingM(args: {
  x_pct: number;
  y_pct: number;
  wPx: number;
  hPx: number;
  scale: number;
  scaleM: number;
  boardAspect?: number;
}): [number, number][] {
  const aspect = args.boardAspect ?? 1;
  const origin = pctToLocalM(args.x_pct, args.y_pct, args.scaleM, aspect);
  const { width_m, height_m } = itemFootprintMetres({
    wPx: args.wPx,
    hPx: args.hPx,
    scale: args.scale,
  });
  const hx = width_m / 2;
  const hy = height_m / 2;
  return [
    [origin.x_m - hx, origin.y_m - hy],
    [origin.x_m + hx, origin.y_m - hy],
    [origin.x_m + hx, origin.y_m + hy],
    [origin.x_m - hx, origin.y_m + hy],
  ];
}

/** Full hybrid metrics for a canvas-placed rect/ellipse symbol. */
export function hybridPlaneForItem(args: {
  x_pct: number;
  y_pct: number;
  wPx: number;
  hPx: number;
  scale: number;
  scaleM: number;
  boardAspect?: number;
  areaKind?: "rect" | "ellipse" | "none";
  linear?: boolean;
}): HybridPlaneMetrics {
  const aspect = args.boardAspect ?? 1;
  const origin = pctToLocalM(args.x_pct, args.y_pct, args.scaleM, aspect);
  const foot = itemFootprintMetres({
    wPx: args.wPx,
    hPx: args.hPx,
    scale: args.scale,
    areaKind: args.areaKind,
    linear: args.linear,
  });
  const w_pct = args.scaleM > 0 ? (foot.width_m / args.scaleM) * 100 : 0;
  const h_pct =
    args.scaleM > 0 ? (foot.height_m / (args.scaleM / aspect)) * 100 : 0;
  return {
    canvas: {
      x_pct: args.x_pct,
      y_pct: args.y_pct,
      w_pct,
      h_pct,
    },
    physical: {
      origin_m: origin,
      width_m: foot.width_m,
      height_m: foot.height_m,
      area_m2: foot.area_m2,
      perimeter_m: foot.perimeter_m,
    },
  };
}

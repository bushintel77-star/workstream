/**
 * Map Vicmap urban tree canvas-metre points → exist ghost placements.
 * Never invent DBH — canopy radius only scales the glyph roughly.
 */

export type UrbanTreeCanvasPoint = {
  x: number;
  y: number;
  canopy_radius_m?: number | null;
  height_m?: number | null;
  label?: string | null;
};

export type UrbanTreeGhostPlacement = {
  symbol_id: "existing-tree-retain";
  x_pct: number;
  y_pct: number;
  confidence: number;
  reason: string;
  /** Glyph scale hint from canopy radius (not DBH). */
  scale: number;
  /**
   * Vicmap LiDAR height (m) when present — the ACTUAL height of this tree, not
   * a mature-height estimate. Carried onto the StudioItem so the elevation
   * draws the same metres the plan tooltip reads (see geometry/itemHeight).
   * Null when Vicmap has no height for the point.
   */
  heightM?: number | null;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

/** ~6 m canopy → scale 1 at 110 m board; clamp for tiny / huge canopies. */
export function canopyRadiusToGlyphScale(
  canopyRadiusM: number | null | undefined,
  boardWidthM = 110,
): number {
  if (canopyRadiusM == null || !(canopyRadiusM > 0) || !(boardWidthM > 0)) {
    return 1;
  }
  const ref = 6;
  const raw = canopyRadiusM / ref;
  return Math.max(0.55, Math.min(1.45, raw));
}

/**
 * Vicmap Tree Urban `height_m` is a LiDAR-derived height in metres
 * (NUMBER(5,2), per the DELWP metadata), NOT a class code — so it is rendered
 * as metres. But the model was trained on trees > ~2 m, and a height that
 * contradicts the canopy (a 1 m tree carrying an 8.6 m canopy) is a LiDAR
 * artifact or a shrub misclassified as a tree. Flag it instead of silently
 * presenting an impossible tree to a council or arborist.
 *
 * `canopy_radius_m` is a RADIUS. The plan label prints the DIAMETER (canopy
 * spread) — the figure an arborist reads as the tree's reach. Rendering the
 * radius as "~4.3 m canopy" reads as a 4.3 m tree on a drawing and understates
 * the canopy by 2×.
 */
const HEIGHT_SUSPECT_MIN_M = 2;
const CANOPY_DIAMETER_TO_HEIGHT_MAX = 4;

function heightIsSuspect(
  heightM: number | null | undefined,
  canopyRadiusM: number | null | undefined,
): boolean {
  if (heightM == null || !(heightM > 0)) return false;
  if (heightM < HEIGHT_SUSPECT_MIN_M) return true;
  if (canopyRadiusM != null && canopyRadiusM > 0) {
    const diameterM = canopyRadiusM * 2;
    if (diameterM / heightM > CANOPY_DIAMETER_TO_HEIGHT_MAX) return true;
  }
  return false;
}

/**
 * Project canvas-metre tree points through the title letterbox transform
 * (same as parcel hydrate) into board % exist ghosts.
 */
export function urbanTreesToExistGhosts(args: {
  trees: UrbanTreeCanvasPoint[];
  toPct: (pt: { x: number; y: number }) => { x: number; y: number };
  boardWidthM?: number;
}): UrbanTreeGhostPlacement[] {
  const boardM = args.boardWidthM ?? 110;
  return args.trees.map((t) => {
    const pct = args.toPct({ x: t.x, y: t.y });
    const species = t.label?.trim() || "Urban tree";
    const bits = [`Vicmap ${species}`];
    if (t.height_m != null && t.height_m > 0) {
      // toFixed(1) mirrors the elevation callout so the plan tooltip and the
      // elevation board read the SAME number for one tree.
      bits.push(`~${t.height_m.toFixed(1)} m high`);
    }
    if (t.canopy_radius_m != null && t.canopy_radius_m > 0) {
      // Diameter (canopy spread) — the radius is in the data, the reach is 2×.
      bits.push(`~${(t.canopy_radius_m * 2).toFixed(1)} m canopy spread`);
    }
    bits.push("measure DBH on site for TPZ");
    if (heightIsSuspect(t.height_m, t.canopy_radius_m)) {
      bits.push("height suspect — confirm on site");
    }
    return {
      symbol_id: "existing-tree-retain" as const,
      x_pct: clampPct(pct.x),
      y_pct: clampPct(pct.y),
      confidence: 0.72,
      reason: bits.join(" · "),
      scale: canopyRadiusToGlyphScale(t.canopy_radius_m, boardM),
      heightM:
        t.height_m != null && t.height_m > 0 ? t.height_m : null,
    };
  });
}

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
      bits.push(`~${Math.round(t.height_m)} m high`);
    }
    if (t.canopy_radius_m != null && t.canopy_radius_m > 0) {
      bits.push(`~${t.canopy_radius_m.toFixed(1)} m canopy`);
    }
    bits.push("measure DBH on site for TPZ");
    return {
      symbol_id: "existing-tree-retain" as const,
      x_pct: clampPct(pct.x),
      y_pct: clampPct(pct.y),
      confidence: 0.72,
      reason: bits.join(" · "),
      scale: canopyRadiusToGlyphScale(t.canopy_radius_m, boardM),
    };
  });
}

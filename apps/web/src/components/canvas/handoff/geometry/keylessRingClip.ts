/**
 * Plan hatch fill contract (systemic — KEYLESS / easement / any area wash):
 *
 * 1. Pattern fills paint *geometry*, never the SVG/board wrapper.
 * 2. Area washes clip to the title boundary (`clipPath` at paint time).
 * 3. Authority-scale districts (water corp, LGA…) never hatch-fill — chip
 *    labels only. Projected with the parcel letterbox they span far beyond
 *    the board; SVG then paints the viewBox intersection as a plate wash.
 * 4. Never clampPct those vertices (that invents a full-board rectangle).
 *
 * Same failure mode as tilt opaque wrappers: fill/pattern without a
 * geometry clip defaults to parent bounds.
 */

export type KeylessPctPt = { x_pct: number; y_pct: number };

export type KeylessBbox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * District overlays — never hatch-fill (chip / stroke cue only).
 * `planning` can still fill when local; authority-scale planning is rejected
 * via {@link isAuthorityScaleKeylessRing}.
 */
export const KEYLESS_DISTRICT_NO_FILL_KINDS = new Set([
  "water_corp",
  "road_casement",
]);

/** @deprecated Use KEYLESS_DISTRICT_NO_FILL_KINDS + authority-scale check. */
export const KEYLESS_AUTHORITY_FILL_KINDS = new Set([
  "water_corp",
  "road_casement",
  "planning",
]);

/** Shared SVG clipPath id for title-lot hatch masking (per-SVG defs). */
export const PLAN_LOT_HATCH_CLIP_ID = "ws-plan-lot-hatch-clip";

/** Bbox span (board %) above which a ring is treated as authority-scale. */
export const KEYLESS_AUTHORITY_SPAN_PCT = 150;

export function keylessRingBbox(ring: KeylessPctPt[]): KeylessBbox | null {
  if (ring.length < 1) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (!Number.isFinite(p.x_pct) || !Number.isFinite(p.y_pct)) continue;
    minX = Math.min(minX, p.x_pct);
    minY = Math.min(minY, p.y_pct);
    maxX = Math.max(maxX, p.x_pct);
    maxY = Math.max(maxY, p.y_pct);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Any overlap with the board unit square [0,100]². */
export function keylessRingHitsBoard(ring: KeylessPctPt[]): boolean {
  const b = keylessRingBbox(ring);
  if (!b) return false;
  return !(b.maxX < 0 || b.minX > 100 || b.maxY < 0 || b.minY > 100);
}

export function isAuthorityScaleKeylessRing(
  ring: KeylessPctPt[],
  spanPct = KEYLESS_AUTHORITY_SPAN_PCT,
): boolean {
  const b = keylessRingBbox(ring);
  if (!b) return false;
  return b.maxX - b.minX > spanPct || b.maxY - b.minY > spanPct;
}

/**
 * Whether to paint a hatched fill for this ring.
 * Contours / open polylines are handled separately (stroke only).
 */
export function shouldPaintKeylessFill(
  kind: string,
  ring: KeylessPctPt[],
): boolean {
  if (ring.length < 3) return false;
  if (!keylessRingHitsBoard(ring)) return false;
  /* Water corp / road casement are authority districts — never a lot wash. */
  if (KEYLESS_DISTRICT_NO_FILL_KINDS.has(kind)) return false;
  if (kind === "planning" && isAuthorityScaleKeylessRing(ring)) return false;
  return true;
}

/**
 * Board-% ring ({x,y}) — same authority-scale test for easement hatch etc.
 * Never paint a pattern fill whose bbox spans >> the board without a lot clip.
 */
export function isAuthorityScalePctRing(
  ring: Array<{ x: number; y: number }>,
  spanPct = KEYLESS_AUTHORITY_SPAN_PCT,
): boolean {
  if (ring.length < 1) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return false;
  return maxX - minX > spanPct || maxY - minY > spanPct;
}

/** Drop rings that miss the board entirely (hydrate hygiene). */
export function filterKeylessRingsToBoard(
  rings: KeylessPctPt[][],
): KeylessPctPt[][] {
  return rings.filter((r) => r.length >= 2 && keylessRingHitsBoard(r));
}

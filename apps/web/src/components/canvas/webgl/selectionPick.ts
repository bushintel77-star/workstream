/**
 * Gold Standard 2026 — selection picking math (pure, unit-tested).
 *
 * ONE selection concept across the three selectable entity families:
 * placements, converted LandscapeFeatures, and photo-trace strokes. A
 * SelectionRef names the family + id (+ the photo-elevation owner for plane
 * strokes). The store holds the refs; these helpers do the geometry
 * hit-tests and the pruning when entities leave the document.
 */

import type {
  CatalogPlacement,
  LandscapeFeature,
  PhotoElevation,
  PhotoTraceStroke,
} from "@workstream/contracts";
import type { PctPoint } from "./coordTransform";

export type SelectionRef = {
  kind: "placement" | "feature" | "photoStroke" | "boundary" | "building";
  id: string;
  /** Photo-elevation owner — required for photoStroke refs. */
  elevationId?: string;
};

function pointSegDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Placement glyph grab radius in metres. */
const PLACEMENT_PICK_M = 1.8;
/** Feature linework grab radius in metres. */
const FEATURE_PICK_M = 1.1;
/** Photo-trace stroke grab radius in plane metres. */
const PLANE_STROKE_PICK_M = 0.35;

function mToPct(m: number, scaleM: number): number {
  return (m / Math.max(0.1, scaleM)) * 100;
}

/** Nearest placement to the board-% click within the glyph grab radius. */
export function nearestPlacementId(
  placements: CatalogPlacement[],
  pct: PctPoint,
  scaleM: number,
): string | null {
  const maxPct = mToPct(PLACEMENT_PICK_M, scaleM);
  let best: string | null = null;
  let bestD = maxPct;
  for (const p of placements) {
    const d = Math.hypot(p.x_pct - pct.x, p.y_pct - pct.y);
    if (d <= bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}

/** Distance in board-% from the click to a feature's geometry edges. */
export function featurePickDistancePct(
  feature: LandscapeFeature,
  pct: PctPoint,
): number {
  const pts = feature.geometry.points.map((v) => ({
    x: v.pct.x_pct,
    y: v.pct.y_pct,
  }));
  if (pts.length === 0) return Number.POSITIVE_INFINITY;
  const closed = feature.geometry.type === "Polygon";
  let best = Number.POSITIVE_INFINITY;
  const n = closed && pts.length >= 3 ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    best = Math.min(
      best,
      pointSegDist(pct.x, pct.y, a.x, a.y, b.x, b.y),
    );
  }
  return best;
}

/** Nearest feature edge to the click within the linework grab radius. */
export function nearestFeatureId(
  features: LandscapeFeature[],
  pct: PctPoint,
  scaleM: number,
): string | null {
  const maxPct = mToPct(FEATURE_PICK_M, scaleM);
  let best: string | null = null;
  let bestD = maxPct;
  for (const f of features) {
    const d = featurePickDistancePct(f, pct);
    if (d <= bestD) {
      bestD = d;
      best = f.id;
    }
  }
  return best;
}

/** Nearest photo-trace stroke to a plane-space click point. */
export function nearestPlaneStrokeId(
  strokes: PhotoTraceStroke[],
  point: { x_m: number; y_m: number },
): string | null {
  let best: string | null = null;
  let bestD = PLANE_STROKE_PICK_M;
  for (const s of strokes) {
    const pts = s.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const d = pointSegDist(point.x_m, point.y_m, a.x_m, a.y_m, b.x_m, b.y_m);
      if (d <= bestD) {
        bestD = d;
        best = s.id;
      }
    }
  }
  return best;
}

export function sameRef(a: SelectionRef, b: SelectionRef): boolean {
  return (
    a.kind === b.kind && a.id === b.id && a.elevationId === b.elevationId
  );
}

export function hasRef(refs: SelectionRef[], ref: SelectionRef): boolean {
  return refs.some((r) => sameRef(r, ref));
}

export function dedupeSelection(refs: SelectionRef[]): SelectionRef[] {
  const out: SelectionRef[] = [];
  for (const ref of refs) {
    if (!hasRef(out, ref)) out.push(ref);
  }
  return out;
}

/**
 * Drop refs whose entity no longer exists in the document (undo / redo /
 * hydrate / entity removal). Entities that exist elsewhere — e.g. a
 * placement whose id also mirrors a feature — survive as their own ref.
 * Site elements (boundary, building) persist while the ring exists.
 */
export function pruneSelection(
  refs: SelectionRef[],
  doc: {
    placements: CatalogPlacement[];
    features: LandscapeFeature[];
    photoElevations: PhotoElevation[];
    siteBoundary?: PctPoint[];
    siteBuilding?: PctPoint[];
  },
): SelectionRef[] {
  const placementIds = new Set(doc.placements.map((p) => p.id));
  const featureIds = new Set(doc.features.map((f) => f.id));
  const photoStrokeIds = new Set<string>();
  for (const e of doc.photoElevations) {
    for (const s of e.strokes) photoStrokeIds.add(s.id);
  }
  const hasBoundary = (doc.siteBoundary ?? []).length >= 3;
  const hasBuilding = (doc.siteBuilding ?? []).length >= 3;
  return refs.filter((r) => {
    if (r.kind === "placement") return placementIds.has(r.id);
    if (r.kind === "feature") return featureIds.has(r.id);
    if (r.kind === "photoStroke") return photoStrokeIds.has(r.id);
    if (r.kind === "boundary") return hasBoundary;
    if (r.kind === "building") return hasBuilding;
    return false;
  });
}

/** Boundary line grab radius in metres — wider than features: the title
 * line is the site's anchor and a near-miss should still select it. */
const BOUNDARY_PICK_M = 2.5;

/** True when the board-% click is within the boundary line grab radius. */
export function boundaryHitTest(
  boundary: PctPoint[],
  pct: PctPoint,
  scaleM: number,
): boolean {
  if (boundary.length < 3) return false;
  const maxPct = mToPct(BOUNDARY_PICK_M, scaleM);
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % boundary.length]!;
    if (pointSegDist(pct.x, pct.y, a.x, a.y, b.x, b.y) <= maxPct) return true;
  }
  return false;
}

/** Building footprint grab radius — same as boundary (it's also a mass). */
const BUILDING_PICK_M = 2.5;

/** True when the click is on/near the building footprint outline. */
export function buildingHitTest(
  building: PctPoint[],
  pct: PctPoint,
  scaleM: number,
): boolean {
  if (building.length < 3) return false;
  const maxPct = mToPct(BUILDING_PICK_M, scaleM);
  for (let i = 0; i < building.length; i++) {
    const a = building[i]!;
    const b = building[(i + 1) % building.length]!;
    if (pointSegDist(pct.x, pct.y, a.x, a.y, b.x, b.y) <= maxPct) return true;
  }
  return false;
}

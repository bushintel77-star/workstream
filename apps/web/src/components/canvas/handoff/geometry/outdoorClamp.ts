import {
  buildableEnvelopeFromBoundary,
  localMToPct,
  shouldEnforceSetback,
  snapPointToBuildableEnvelope,
  workableCanvasM2,
} from "@workstream/domain";
import type { StudioItem, StudioItemType } from "../studioCatalog";
import { pctRingToPlanarM, pointInPolygon } from "./polygon";
import type { PctPoint } from "./types";

/**
 * Outdoor / garden workable area = title parcel − housing envelope.
 *
 * Hard rule: every asset *centre* (trunk / symbol origin) must sit in outdoor.
 * Tree canopy discs may overhang the fence — that is intentional and happens
 * in rendering via canopyM; we never clip crowns to the lot.
 */

export function isPointInOutdoor(
  p: PctPoint,
  boundary: PctPoint[],
  building: PctPoint[],
): boolean {
  if (boundary.length < 3) return true;
  if (!pointInPolygon(p, boundary)) return false;
  if (building.length >= 3 && pointInPolygon(p, building)) return false;
  return true;
}

function ringCentroid(ring: PctPoint[]): PctPoint {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, ring.length);
  return { x: x / n, y: y / n };
}

function nearestOnSegment(
  p: PctPoint,
  a: PctPoint,
  b: PctPoint,
): PctPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Closest point on a closed ring's edges. */
export function nearestPointOnRing(p: PctPoint, ring: PctPoint[]): PctPoint {
  if (ring.length === 0) return { x: p.x, y: p.y };
  if (ring.length === 1) return { x: ring[0]!.x, y: ring[0]!.y };
  let best = ring[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const q = nearestOnSegment(p, a, b);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

function nudgeToward(
  from: PctPoint,
  toward: PctPoint,
  distPct: number,
): PctPoint {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return from;
  return {
    x: from.x + (dx / len) * distPct,
    y: from.y + (dy / len) * distPct,
  };
}

function nudgeAway(
  from: PctPoint,
  awayFrom: PctPoint,
  distPct: number,
): PctPoint {
  return nudgeToward(from, {
    x: from.x - (awayFrom.x - from.x),
    y: from.y - (awayFrom.y - from.y),
  }, distPct);
}

export type OutdoorSnapResult = {
  x: number;
  y: number;
  snapped: boolean;
  reason: string | null;
};

/**
 * Pull a proposed centre into outdoor (boundary − building).
 * Used on place / move / nudge / hydrate — never optional for live assets.
 */
export function snapPointToOutdoor(
  p: PctPoint,
  boundary: PctPoint[],
  building: PctPoint[],
): OutdoorSnapResult {
  if (boundary.length < 3) {
    return {
      x: Math.max(0, Math.min(100, p.x)),
      y: Math.max(0, Math.min(100, p.y)),
      snapped: false,
      reason: null,
    };
  }

  if (isPointInOutdoor(p, boundary, building)) {
    return { x: p.x, y: p.y, snapped: false, reason: null };
  }

  const lotMid = ringCentroid(boundary);
  let q: PctPoint;

  if (!pointInPolygon(p, boundary)) {
    q = nearestPointOnRing(p, boundary);
    q = nudgeToward(q, lotMid, 0.2);
  } else {
    // Inside the housing envelope — push out across the building edge.
    q = nearestPointOnRing(p, building);
    const houseMid = ringCentroid(building);
    q = nudgeAway(q, houseMid, 0.35);
  }

  // Second pass if still illegal (concave lots / thin side yards).
  if (!isPointInOutdoor(q, boundary, building)) {
    q = nearestPointOnRing(q, boundary);
    q = nudgeToward(q, lotMid, 0.35);
  }
  if (
    building.length >= 3 &&
    pointInPolygon(q, building) &&
    pointInPolygon(q, boundary)
  ) {
    q = nudgeAway(q, ringCentroid(building), 0.6);
  }

  return {
    x: Math.max(0, Math.min(100, q.x)),
    y: Math.max(0, Math.min(100, q.y)),
    snapped: true,
    reason: "Kept inside outdoor area (lot − house)",
  };
}

/** Remnant outdoor rings in board-% (Turf difference). */
export function outdoorRemnantRingsPct(
  boundary: PctPoint[],
  building: PctPoint[],
  scaleM = 100,
  boardAspect = 1,
): PctPoint[][] {
  if (boundary.length < 3) return [];
  const buildings =
    building.length >= 3
      ? [pctRingToPlanarM(building, scaleM, boardAspect)]
      : [];
  const diff = workableCanvasM2(
    pctRingToPlanarM(boundary, scaleM, boardAspect),
    { buildings },
  );
  return diff.polygons.map((ring) =>
    ring.map(([xM, yM]) => {
      const p = localMToPct(xM, yM, scaleM, boardAspect);
      return { x: p.x_pct, y: p.y_pct };
    }),
  );
}

export type OutdoorFocusView = {
  focusX: number;
  focusY: number;
  zoom: number;
};

/**
 * Frame the workable garden (outdoor remnant) — not the whole cadastral lot.
 * Zoom origin sits on the remnant centre so Fit maximises garden work area.
 */
export function outdoorFocusView(
  boundary: PctPoint[],
  building: PctPoint[],
  scaleM = 100,
): OutdoorFocusView {
  const rings = outdoorRemnantRingsPct(boundary, building, scaleM);
  const pts = rings.flat();
  const use = pts.length >= 2 ? pts : boundary;
  if (use.length < 2) {
    return { focusX: 50, focusY: 50, zoom: 1 };
  }
  const xs = use.map((p) => p.x);
  const ys = use.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 10);
  // Fill ~90% of the board with the outdoor bbox. Soft ceiling keeps fit
  // usable on tiny remnants; infinite zoom still goes beyond via wheel.
  const FIT_ZOOM_MAX = 16;
  const zoom = Math.max(
    1,
    Math.min(FIT_ZOOM_MAX, Number((90 / span).toFixed(2))),
  );
  return {
    focusX: Number(midX.toFixed(2)),
    focusY: Number(midY.toFixed(2)),
    zoom,
  };
}

/** Pull every live asset centre into outdoor. Ghosts included (layout proposals). */
export function sanitizeItemsToOutdoor(
  items: StudioItem[],
  boundary: PctPoint[],
  building: PctPoint[],
): StudioItem[] {
  if (boundary.length < 3) return items;
  return items.map((it) => {
    const r = snapPointToOutdoor({ x: it.x, y: it.y }, boundary, building);
    if (!r.snapped) return it;
    return { ...it, x: r.x, y: r.y };
  });
}

/**
 * Place / move constraint: outdoor first (hard), then council setback AABB
 * for structure types, then outdoor again so setback cannot park in the house.
 */
export function constrainAssetCentre(
  x: number,
  y: number,
  type: StudioItemType,
  boundary: PctPoint[],
  building: PctPoint[],
): OutdoorSnapResult {
  let tip: string | null = null;
  let r = snapPointToOutdoor({ x, y }, boundary, building);
  let px = r.x;
  let py = r.y;
  if (r.snapped) tip = r.reason;

  if (shouldEnforceSetback(type)) {
    const env = buildableEnvelopeFromBoundary(boundary);
    const s = snapPointToBuildableEnvelope(px, py, env);
    px = s.x;
    py = s.y;
    if (s.snapped) tip = s.codeHint;
    r = snapPointToOutdoor({ x: px, y: py }, boundary, building);
    px = r.x;
    py = r.y;
    if (r.snapped && !tip) tip = r.reason;
  }

  return {
    x: px,
    y: py,
    snapped: tip != null,
    reason: tip,
  };
}

/**
 * Sketch → CAD interpretation — freehand ink becomes typed site-plan ghosts.
 *
 * Heuristic (Workflow 1): geometry of strokes + boundary / building context
 * → GhostPlacementSuggestion[]. Sun / setback / envelope applied by the
 * studio engine when merging proposals.
 */

import { clampBoardPct } from "@workstream/contracts";

export type SketchStrokeInput = {
  id: string;
  points: Array<{ x: number; y: number }>;
};

export type SketchToCadContext = {
  boundary: Array<{ x: number; y: number }>;
  building: Array<{ x: number; y: number }>;
  /** Optional board width metres for length thresholds. */
  scaleM?: number;
};

/**
 * Vocabulary the stroke classifier emits. A mix of abstract studio types
 * (hedge, deck, lawn, canopy, frenchdrain — mapped to StudioItemType by the
 * client engine) and concrete Curtis catalog ids. The API's catalog filter
 * must treat all of these as allowed or heuristic formalize returns empty.
 */
export const SKETCH_CAD_SYMBOL_IDS = [
  "hedge",
  "frenchdrain",
  "bluestone-paver",
  "deck",
  "lawn",
  "lomandra-mass",
  "canopy",
  "olive-standard",
] as const;

export type SketchCadSuggestion = {
  id: string;
  symbol_id: string;
  x_pct: number;
  y_pct: number;
  confidence: number;
  reason: string;
  /** Suggested scale for the studio glyph. */
  scaleHint?: number;
  rotDeg?: number;
  /**
   * Decimated drawn outline (≤24 points, board %) — present only for closed
   * area masses (deck / lawn / bed) so the CAD plan can render the region the
   * operator actually drew instead of a glyph at the centroid.
   */
  outlinePct?: Array<{ x: number; y: number }>;
};

type StrokeMetrics = {
  id: string;
  cx: number;
  cy: number;
  lengthPct: number;
  spanX: number;
  spanY: number;
  closed: boolean;
  aspect: number;
  pointCount: number;
};

function strokeMetrics(stroke: SketchStrokeInput): StrokeMetrics | null {
  const pts = stroke.points;
  if (pts.length < 2) return null;
  let length = 0;
  let minX = pts[0]!.x;
  let maxX = pts[0]!.x;
  let minY = pts[0]!.y;
  let maxY = pts[0]!.y;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!;
    sx += p.x;
    sy += p.y;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (i > 0) {
      const a = pts[i - 1]!;
      length += Math.hypot(p.x - a.x, p.y - a.y);
    }
  }
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
  const spanX = Math.max(0.01, maxX - minX);
  const spanY = Math.max(0.01, maxY - minY);
  const closed = closeDist < Math.max(3, Math.min(spanX, spanY) * 0.35);
  return {
    id: stroke.id,
    cx: sx / pts.length,
    cy: sy / pts.length,
    lengthPct: length,
    spanX,
    spanY,
    closed,
    aspect: spanX / spanY,
    pointCount: pts.length,
  };
}

/**
 * Decimation target for a drawn outline. Well under the contract's
 * `MAX_SUGGESTION_OUTLINE_POINTS` cap on `SketchCadSuggestion.outline_pct` —
 * the schema states what will be accepted, this states what we choose to send.
 */
const MAX_OUTLINE_POINTS = 24;

/** Evenly decimate a point run to ≤ MAX_OUTLINE_POINTS, landed on the board. */
function decimateOutline(
  pts: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> | undefined {
  if (pts.length < 3) return undefined;
  const out: Array<{ x: number; y: number }> = [];
  const step = pts.length <= MAX_OUTLINE_POINTS ? 1 : pts.length / MAX_OUTLINE_POINTS;
  for (let i = 0; i < pts.length && out.length < MAX_OUTLINE_POINTS; i += step) {
    const p = pts[Math.floor(i)]!;
    out.push({ x: clampBoardPct(p.x), y: clampBoardPct(p.y) });
  }
  return out.length >= 3 ? out : undefined;
}

/** Convex hull via Andrew's monotone chain (counter-clockwise, no repeat). */
function convexHull(
  pts: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function ringBounds(ring: Array<{ x: number; y: number }>) {
  if (ring.length === 0) {
    return { minX: 20, maxX: 80, minY: 20, maxY: 80, cx: 50, cy: 50 };
  }
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function classifyStroke(
  m: StrokeMetrics,
  ctx: SketchToCadContext,
  outline?: Array<{ x: number; y: number }>,
): SketchCadSuggestion {
  const lot = ringBounds(ctx.boundary);
  const house = ringBounds(ctx.building);
  const rearOfHouse = m.cy > house.maxY - 2;
  const westSide = m.cx < house.cx - 2;
  const nearBoundary =
    m.cx < lot.minX + 8 ||
    m.cx > lot.maxX - 8 ||
    m.cy < lot.minY + 8 ||
    m.cy > lot.maxY - 8;
  const longLinear = m.lengthPct > 18 && Math.max(m.aspect, 1 / m.aspect) > 2.4;
  const tinyMark = Math.max(m.spanX, m.spanY) < 6;
  const compact = m.spanX < 10 && m.spanY < 10 && m.lengthPct < 22;

  // Linear corridor — hedge / drain / path
  if (longLinear && !m.closed) {
    if (nearBoundary) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "hedge",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.86,
        reason: "Sketch line along boundary → clipped hedge screen",
        scaleHint: Math.min(1.3, 0.55 + m.lengthPct / 80),
        rotDeg: m.aspect >= 1 ? 0 : 90,
      };
    }
    if (rearOfHouse || m.cy > lot.cy) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "frenchdrain",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.84,
        reason: "Sketch line near house/low → french drain intercept",
        scaleHint: 0.8,
        rotDeg: m.aspect >= 1 ? 0 : 90,
      };
    }
    return {
      id: `stroke-${m.id}`,
      symbol_id: "bluestone-paver",
      x_pct: m.cx,
      y_pct: m.cy,
      confidence: 0.82,
      reason: "Sketch path → bluestone paving run",
      scaleHint: Math.min(1.2, 0.5 + m.lengthPct / 90),
      rotDeg: m.aspect >= 1 ? 0 : 90,
    };
  }

  // Tiny mark — a dot / small circle is a tree, never a planting bed. Must
  // fire BEFORE the closed-mass test: a 3-point dot has close-distance < 3%
  // and would otherwise read as "closed".
  if (tinyMark) {
    if (westSide || rearOfHouse) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "canopy",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.88,
        reason: westSide
          ? "Sketch mark west of house → shade canopy for afternoon sun"
          : "Sketch mark → canopy anchor in the outdoor room",
        scaleHint: 0.85,
      };
    }
    return {
      id: `stroke-${m.id}`,
      symbol_id: "olive-standard",
      x_pct: m.cx,
      y_pct: m.cy,
      confidence: 0.8,
      reason: "Sketch mark → specimen / feature planting",
      scaleHint: 0.75,
    };
  }

  // Closed mass — bed / lawn / deck / paving pad
  if (m.closed || (m.pointCount >= 8 && m.spanX > 6 && m.spanY > 6)) {
    const area = m.spanX * m.spanY;
    if (rearOfHouse && area > 40) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "deck",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.9,
        reason: "Closed sketch at rear door → deck outdoor room",
        scaleHint: Math.min(1.35, 0.6 + area / 400),
        outlinePct: outline,
      };
    }
    if (area > 70) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "lawn",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.83,
        reason: "Large closed sketch → lawn panel",
        scaleHint: Math.min(1.4, 0.65 + area / 500),
        outlinePct: outline,
      };
    }
    return {
      id: `stroke-${m.id}`,
      symbol_id: "lomandra-mass",
      x_pct: m.cx,
      y_pct: m.cy,
      confidence: 0.85,
      reason: "Closed sketch → mass planting bed",
      scaleHint: Math.min(1.25, 0.55 + area / 350),
      outlinePct: outline,
    };
  }

  // Compact mark — canopy / feature; west of house prefers shade canopy
  if (compact || m.pointCount < 10) {
    if (westSide || rearOfHouse) {
      return {
        id: `stroke-${m.id}`,
        symbol_id: "canopy",
        x_pct: m.cx,
        y_pct: m.cy,
        confidence: 0.88,
        reason: westSide
          ? "Sketch mark west of house → shade canopy for afternoon sun"
          : "Sketch mark → canopy anchor in the outdoor room",
        scaleHint: 0.85,
      };
    }
    return {
      id: `stroke-${m.id}`,
      symbol_id: "olive-standard",
      x_pct: m.cx,
      y_pct: m.cy,
      confidence: 0.8,
      reason: "Sketch mark → specimen / feature planting",
      scaleHint: 0.75,
    };
  }

  // Default mass bed
  return {
    id: `stroke-${m.id}`,
    symbol_id: "lomandra-mass",
    x_pct: m.cx,
    y_pct: m.cy,
    confidence: 0.78,
    reason: "Sketch gesture → planting mass (review to swap)",
    scaleHint: 0.7,
  };
}

type MeasuredStroke = { stroke: SketchStrokeInput; m: StrokeMetrics };

/**
 * Substantial bbox overlap — overlap area / min(bbox area) > 0.5. Catches
 * hatching and double outlines while leaving merely adjacent strokes alone.
 */
function bboxesOverlapSubstantially(a: StrokeMetrics, b: StrokeMetrics): boolean {
  const aMinX = a.cx - a.spanX / 2;
  const aMaxX = a.cx + a.spanX / 2;
  const aMinY = a.cy - a.spanY / 2;
  const aMaxY = a.cy + a.spanY / 2;
  const bMinX = b.cx - b.spanX / 2;
  const bMaxX = b.cx + b.spanX / 2;
  const bMinY = b.cy - b.spanY / 2;
  const bMaxY = b.cy + b.spanY / 2;
  const ox = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX);
  const oy = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY);
  if (ox <= 0 || oy <= 0) return false;
  const overlap = ox * oy;
  const minArea = Math.min(a.spanX * a.spanY, b.spanX * b.spanY);
  return overlap / Math.max(0.01, minArea) > 0.5;
}

/**
 * A stroke may join a cluster if it reads as area work — closed, or not a
 * long thin linear run. A drain / hedge line crossing a bed's bbox must stay
 * its own suggestion.
 */
function clusterEligible(m: StrokeMetrics): boolean {
  const thinLinear =
    m.lengthPct > 18 && Math.max(m.aspect, 1 / m.aspect) > 2.4 && !m.closed;
  return !thinLinear;
}

/** Greedy union of strokes whose bboxes overlap substantially. */
function clusterStrokes(measured: MeasuredStroke[]): MeasuredStroke[][] {
  const parent = measured.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    let c = i;
    while (parent[c] !== c) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  for (let i = 0; i < measured.length; i += 1) {
    if (!clusterEligible(measured[i]!.m)) continue;
    for (let j = i + 1; j < measured.length; j += 1) {
      if (!clusterEligible(measured[j]!.m)) continue;
      if (bboxesOverlapSubstantially(measured[i]!.m, measured[j]!.m)) {
        parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, MeasuredStroke[]>();
  measured.forEach((ms, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(ms);
    else groups.set(root, [ms]);
  });
  return [...groups.values()];
}

/**
 * Convert freehand sketch strokes into CAD ghost placement suggestions.
 * Strokes whose bounding boxes overlap substantially (hatching, double
 * outlines) merge into one suggestion; each remaining cluster with ≥2 points
 * yields one suggestion. Empty input → [].
 */
export function interpretSketchStrokesToCad(
  strokes: SketchStrokeInput[],
  ctx: SketchToCadContext,
): SketchCadSuggestion[] {
  const measured: MeasuredStroke[] = [];
  for (const stroke of strokes) {
    const m = strokeMetrics(stroke);
    if (!m) continue;
    measured.push({ stroke, m });
  }
  const out: SketchCadSuggestion[] = [];
  for (const cluster of clusterStrokes(measured)) {
    if (cluster.length === 1) {
      const { stroke, m } = cluster[0]!;
      // Single closed stroke: the drawn points ARE the outline (preserves
      // concavity) — decimated, only attached on the closed-mass branch.
      const outline = m.closed ? decimateOutline(stroke.points) : undefined;
      out.push(classifyStroke(m, ctx, outline));
      continue;
    }
    // Multi-stroke mass (hatching / double outline): classify the merged
    // point cloud, convex hull as the outline.
    const allPoints = cluster.flatMap((c) => c.stroke.points);
    const merged = strokeMetrics({ id: cluster[0]!.stroke.id, points: allPoints });
    if (!merged) continue;
    merged.closed = merged.closed || cluster.some((c) => c.m.closed);
    const outline = decimateOutline(convexHull(allPoints));
    out.push(classifyStroke(merged, ctx, outline));
  }
  return disambiguateReasons(out);
}

/**
 * Several strokes classified the same way (e.g. a few tree dots drawn on the
 * west side, or a couple of closed pads near the rear door) share an
 * identical templated `reason` string — they are genuinely separate
 * proposals (different positions), but with no distinguishing detail they
 * read as literal duplicates in the ghost review list. Tag repeats with an
 * ordinal so "Sketch mark west of house → shade canopy…" becomes
 * "… (2 of 3)" instead of three identical-looking rows.
 */
function disambiguateReasons(
  suggestions: SketchCadSuggestion[],
): SketchCadSuggestion[] {
  const counts = new Map<string, number>();
  for (const s of suggestions) {
    counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return suggestions.map((s) => {
    const total = counts.get(s.reason) ?? 1;
    if (total < 2) return s;
    const index = (seen.get(s.reason) ?? 0) + 1;
    seen.set(s.reason, index);
    return { ...s, reason: `${s.reason} (${index} of ${total})` };
  });
}

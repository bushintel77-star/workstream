/**
 * Sketch → CAD interpretation — freehand ink becomes typed site-plan ghosts.
 *
 * Heuristic (Workflow 1): geometry of strokes + boundary / building context
 * → GhostPlacementSuggestion[]. Sun / setback / envelope applied by the
 * studio engine when merging proposals.
 */

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

/**
 * Convert freehand sketch strokes into CAD ghost placement suggestions.
 * One suggestion per stroke with ≥2 points; empty input → [].
 */
export function interpretSketchStrokesToCad(
  strokes: SketchStrokeInput[],
  ctx: SketchToCadContext,
): SketchCadSuggestion[] {
  const out: SketchCadSuggestion[] = [];
  for (const stroke of strokes) {
    const m = strokeMetrics(stroke);
    if (!m) continue;
    out.push(classifyStroke(m, ctx));
  }
  return out;
}

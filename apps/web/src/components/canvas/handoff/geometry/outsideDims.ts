import type { EdgeSegment, PctPoint } from "./types";
import { polygonCentroid } from "./foundationCadContext";

export type DimSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type OutsideDim = {
  key: string;
  lengthM: number;
  /** Dimension string endpoints (offset outside the polygon). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Label anchor (further outside). */
  labelX: number;
  labelY: number;
  rotDeg: number;
  /** Perpendicular end ticks (45° CAD style via short crossbars). */
  tickA: DimSegment;
  tickB: DimSegment;
  /**
   * Witness / extension lines from the polygon vertex out past the
   * dimension string (with a small overshoot).
   */
  extA: DimSegment;
  extB: DimSegment;
};

/**
 * Readable-up convention: dimension text is never rendered upside-down.
 * Angles that would flip the glyphs (past ±90°) rotate 180° so the label
 * reads left-to-right from the bottom/right of the sheet — standard
 * architectural drafting. Bearing values keep the raw angle; this is
 * presentation only.
 */
export function readableUpDeg(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 90 && d <= 270) d -= 180;
  if (d > 180) d -= 360;
  return d;
}

/**
 * CAD outside-plot dimensions — witness/extension lines, offset dimension
 * string, end ticks, and label placed away from the polygon centroid.
 */
export function buildOutsideDims(
  segs: EdgeSegment[],
  polygon: PctPoint[],
  opts?: {
    offsetPct?: number;
    tickPct?: number;
    labelExtraPct?: number;
    /** Gap from vertex before the extension line starts. */
    gapPct?: number;
    /** How far past the dim string the extension continues. */
    overshootPct?: number;
  },
): OutsideDim[] {
  if (segs.length === 0 || polygon.length < 3) return [];
  const offset = opts?.offsetPct ?? 2.4;
  const tick = opts?.tickPct ?? 1.15;
  const labelExtra = opts?.labelExtraPct ?? 1.5;
  const gap = opts?.gapPct ?? 0.35;
  const overshoot = opts?.overshootPct ?? 0.5;
  const c = polygonCentroid(polygon);

  return segs.map((s) => {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;

    const midOut = {
      x: s.mid.x + nx * offset,
      y: s.mid.y + ny * offset,
    };
    const midIn = {
      x: s.mid.x - nx * offset,
      y: s.mid.y - ny * offset,
    };
    const outDist = (midOut.x - c.x) ** 2 + (midOut.y - c.y) ** 2;
    const inDist = (midIn.x - c.x) ** 2 + (midIn.y - c.y) ** 2;
    if (inDist > outDist) {
      nx = -nx;
      ny = -ny;
    }

    const x1 = s.a.x + nx * offset;
    const y1 = s.a.y + ny * offset;
    const x2 = s.b.x + nx * offset;
    const y2 = s.b.y + ny * offset;

    // Tick is perpendicular to the dim string (= along the edge)
    const tx = (dx / len) * tick;
    const ty = (dy / len) * tick;

    return {
      key: s.key,
      lengthM: s.lengthM,
      x1,
      y1,
      x2,
      y2,
      labelX: s.mid.x + nx * (offset + labelExtra),
      labelY: s.mid.y + ny * (offset + labelExtra),
      rotDeg: s.rotDeg,
      tickA: {
        x1: x1 - tx,
        y1: y1 - ty,
        x2: x1 + tx,
        y2: y1 + ty,
      },
      tickB: {
        x1: x2 - tx,
        y1: y2 - ty,
        x2: x2 + tx,
        y2: y2 + ty,
      },
      extA: {
        x1: s.a.x + nx * gap,
        y1: s.a.y + ny * gap,
        x2: s.a.x + nx * (offset + overshoot),
        y2: s.a.y + ny * (offset + overshoot),
      },
      extB: {
        x1: s.b.x + nx * gap,
        y1: s.b.y + ny * gap,
        x2: s.b.x + nx * (offset + overshoot),
        y2: s.b.y + ny * (offset + overshoot),
      },
    };
  });
}

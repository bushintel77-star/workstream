/**
 * On-site bird's-eye AR overlay helpers (Stage 2 Gate 6).
 *
 * Highest-value slice from strategy §10: stakeholder consensus overlay with
 * **footprint occlusion** (building cutout), not Vision Pro / city-twin
 * chroma-key. Alignment quality is reported as polygon IoU against an
 * optional traced ring — indicative, confirm on site.
 *
 * Domain-pure: no server / DOM imports.
 */

export type ArPctPoint = { x: number; y: number };

export type ArBirdseyePlacement = {
  id: string;
  x: number;
  y: number;
  /** Planting / hardscape proxy radius in board %. */
  r: number;
  kind: "planting" | "hardscape" | "other";
};

export type ArBirdseyeScene = {
  boundary: ArPctPoint[];
  building: ArPctPoint[];
  placements: ArBirdseyePlacement[];
  honesty: string;
  occlusion: "footprint";
};

export const AR_BIRDSEYE_HONESTY =
  "Bird's-eye AR — working plan metres, footprint occlusion only. Not survey set-out; confirm on site.";

/** Minimum IoU to call the overlay "aligned enough" for consensus (indicative). */
export const AR_ALIGN_IOU_OK = 0.35;

function ringClosed(pts: readonly ArPctPoint[]): ArPctPoint[] {
  if (pts.length < 3) return [...pts];
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first.x === last.x && first.y === last.y) return [...pts];
  return [...pts, { x: first.x, y: first.y }];
}

/** Shoelace area in %-space (absolute). */
export function polygonAreaPct(pts: readonly ArPctPoint[]): number {
  const ring = ringClosed(pts);
  if (ring.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function pointInRing(p: ArPctPoint, ring: readonly ArPctPoint[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const hit =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

/**
 * Approximate intersection area by grid sampling in the union AABB.
 * Fine enough for an alignment score; not cadastral.
 */
export function polygonIntersectionAreaPct(
  a: readonly ArPctPoint[],
  b: readonly ArPctPoint[],
): number {
  if (a.length < 3 || b.length < 3) return 0;
  const xs = [...a, ...b].map((p) => p.x);
  const ys = [...a, ...b].map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (!(maxX > minX) || !(maxY > minY)) return 0;

  const steps = 48;
  const dx = (maxX - minX) / steps;
  const dy = (maxY - minY) / steps;
  let hits = 0;
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      const p = {
        x: minX + (i + 0.5) * dx,
        y: minY + (j + 0.5) * dy,
      };
      if (pointInRing(p, a) && pointInRing(p, b)) hits += 1;
    }
  }
  return hits * dx * dy;
}

/** Intersection-over-union for two board rings (0–1). */
export function polygonIou(
  a: readonly ArPctPoint[],
  b: readonly ArPctPoint[],
): number {
  const aa = polygonAreaPct(a);
  const bb = polygonAreaPct(b);
  if (aa <= 0 || bb <= 0) return 0;
  const inter = polygonIntersectionAreaPct(a, b);
  const union = aa + bb - inter;
  if (union <= 0) return 0;
  return Math.min(1, Math.max(0, inter / union));
}

export function arAlignLabel(iou: number): "poor" | "fair" | "good" {
  if (iou >= 0.55) return "good";
  if (iou >= AR_ALIGN_IOU_OK) return "fair";
  return "poor";
}

export type ArBirdseyeInput = {
  boundary?: Array<{ x_pct?: number; y_pct?: number; x?: number; y?: number }>;
  building?: Array<{ x_pct?: number; y_pct?: number; x?: number; y?: number }>;
  placements?: Array<{
    id: string;
    x_pct: number;
    y_pct: number;
    symbol_id?: string | null;
  }>;
};

function toPct(
  p: { x_pct?: number; y_pct?: number; x?: number; y?: number },
): ArPctPoint | null {
  const x = typeof p.x_pct === "number" ? p.x_pct : p.x;
  const y = typeof p.y_pct === "number" ? p.y_pct : p.y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function classifyPlacement(symbolId: string | null | undefined): ArBirdseyePlacement["kind"] {
  const s = (symbolId ?? "").toLowerCase();
  if (
    s.includes("paving") ||
    s.includes("deck") ||
    s.includes("bluestone") ||
    s.includes("hardscape")
  ) {
    return "hardscape";
  }
  if (
    s.includes("tree") ||
    s.includes("plant") ||
    s.includes("hedge") ||
    s.includes("lawn") ||
    s.includes("bed") ||
    s.includes("canopy")
  ) {
    return "planting";
  }
  return "other";
}

/** Build the AR overlay scene from canvas / site_frame geometry. */
export function buildArBirdseyeScene(input: ArBirdseyeInput): ArBirdseyeScene {
  const boundary = (input.boundary ?? [])
    .map(toPct)
    .filter((p): p is ArPctPoint => p != null);
  const building = (input.building ?? [])
    .map(toPct)
    .filter((p): p is ArPctPoint => p != null);
  const placements: ArBirdseyePlacement[] = (input.placements ?? []).map(
    (p) => {
      const kind = classifyPlacement(p.symbol_id);
      return {
        id: p.id,
        x: p.x_pct,
        y: p.y_pct,
        r: kind === "planting" ? 1.4 : kind === "hardscape" ? 1.1 : 0.9,
        kind,
      };
    },
  );

  return {
    boundary,
    building,
    placements,
    honesty: AR_BIRDSEYE_HONESTY,
    occlusion: "footprint",
  };
}

/** SVG points attribute for a ring. */
export function arRingPointsAttr(pts: readonly ArPctPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

export interface AnnotationAnchor {
  id: string;
  x: number;
  y: number;
  priority?: number;
}

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationSide = "top" | "right" | "bottom" | "left";

/**
 * The discrete candidate a callout landed on. Persisting this across frames is
 * what makes the layout stable: the solver re-derives from scratch every frame
 * inside `useFrame`, and without a memory of last frame's choice a label whose
 * candidates score within a few points of each other flips sides as the camera
 * moves. Stickiness is on the discrete slot rather than on absolute screen
 * position, because the slot's position is derived from the anchor — so a
 * sticky label still tracks its anchor exactly, it just stops changing lanes.
 */
export interface AnnotationSlot {
  side: AnnotationSide;
  laneOffset: number;
  ringScale: number;
}

export interface AnnotationLayoutOptions {
  width: number;
  height: number;
  labelWidth: number;
  labelHeight: number;
  padding?: number;
  gap?: number;
  reserved?: AnnotationRect[];
  maxVisible?: number;
  /** Last frame's slot per anchor id — see `AnnotationSlot`. */
  previous?: ReadonlyMap<string, AnnotationSlot>;
}

export interface AnnotationPlacement extends AnnotationAnchor {
  label: AnnotationRect;
  leader: Array<{ x: number; y: number }>;
  side: AnnotationSide;
  slot: AnnotationSlot;
}

type Side = AnnotationSide;
type Point = { x: number; y: number };

const PERIMETER_SIDES: Side[] = ["top", "right", "bottom", "left"];
const CALLOUT_LANE_ORDER = [0, -1, 1, -2, 2] as const;
const CALLOUT_RING_ORDER = [1, 1.4, 1.8] as const;
const LEADER_EDGE_INSET = 4;

/**
 * Hysteresis discounts. Both sit far below the overlap weights (12000+), so a
 * sticky slot never wins over a collision-free one — it only breaks ties that
 * would otherwise be decided by sub-pixel score noise.
 */
const STICKY_SLOT_BONUS = 900;
const STICKY_SIDE_BONUS = 400;

function overlap(a: AnnotationRect, b: AnnotationRect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const ab = orientation(a1, a2, b1) * orientation(a1, a2, b2);
  const cd = orientation(b1, b2, a1) * orientation(b1, b2, a2);
  return ab < 0 && cd < 0;
}

function pointInside(rect: AnnotationRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function polylineSegments(points: Point[]): Array<[Point, Point]> {
  const out: Array<[Point, Point]> = [];
  for (let index = 0; index < points.length - 1; index++) {
    out.push([points[index]!, points[index + 1]!]);
  }
  return out;
}

function leaderCrossings(leader: Point[], placed: AnnotationPlacement[]): number {
  const segments = polylineSegments(leader);
  let crossings = 0;
  for (const prior of placed) {
    const priorSegments = polylineSegments(prior.leader);
    for (const [a1, a2] of segments) {
      for (const [b1, b2] of priorSegments) {
        if (segmentsCross(a1, a2, b1, b2)) crossings += 1;
      }
    }
  }
  return crossings;
}

function clampRect(
  rect: AnnotationRect,
  options: AnnotationLayoutOptions,
): { label: AnnotationRect; shift: number } {
  const padding = options.padding ?? 24;
  const minX = padding;
  const minY = padding;
  const maxX = Math.max(minX, options.width - padding - rect.width);
  const maxY = Math.max(minY, options.height - padding - rect.height);
  const x = clamp(rect.x, minX, maxX);
  const y = clamp(rect.y, minY, maxY);
  return { label: { ...rect, x, y }, shift: Math.hypot(rect.x - x, rect.y - y) };
}

function candidateFor(side: Side, anchor: AnnotationAnchor, options: AnnotationLayoutOptions): AnnotationRect {
  const padding = options.padding ?? 24;
  const centerX = clamp(anchor.x, padding + options.labelWidth / 2, options.width - padding - options.labelWidth / 2);
  const centerY = clamp(anchor.y, padding + options.labelHeight / 2, options.height - padding - options.labelHeight / 2);
  if (side === "top") return { x: centerX - options.labelWidth / 2, y: padding, width: options.labelWidth, height: options.labelHeight };
  if (side === "right") return { x: options.width - padding - options.labelWidth, y: centerY - options.labelHeight / 2, width: options.labelWidth, height: options.labelHeight };
  if (side === "bottom") return { x: centerX - options.labelWidth / 2, y: options.height - padding - options.labelHeight, width: options.labelWidth, height: options.labelHeight };
  return { x: padding, y: centerY - options.labelHeight / 2, width: options.labelWidth, height: options.labelHeight };
}

function leaderFor(side: Side, anchor: AnnotationAnchor, label: AnnotationRect): Array<{ x: number; y: number }> {
  const center = { x: label.x + label.width / 2, y: label.y + label.height / 2 };
  const edge = side === "top"
    ? { x: center.x, y: label.y + label.height }
    : side === "right"
      ? { x: label.x, y: center.y }
      : side === "bottom"
        ? { x: center.x, y: label.y }
        : { x: label.x + label.width, y: center.y };
  const elbow = side === "top" || side === "bottom"
    ? { x: edge.x, y: anchor.y }
    : { x: anchor.x, y: edge.y };
  return [{ x: anchor.x, y: anchor.y }, elbow, edge];
}

function sideOrderForAnchor(anchor: AnnotationAnchor, options: AnnotationLayoutOptions): Side[] {
  const horizontalOutward: Side = anchor.x <= options.width / 2 ? "left" : "right";
  const horizontalInward: Side = horizontalOutward === "left" ? "right" : "left";
  const verticalOutward: Side = anchor.y <= options.height / 2 ? "top" : "bottom";
  const verticalInward: Side = verticalOutward === "top" ? "bottom" : "top";
  return [horizontalOutward, verticalOutward, horizontalInward, verticalInward];
}

function calloutCandidate(
  side: Side,
  anchor: AnnotationAnchor,
  options: AnnotationLayoutOptions,
  laneOffset: number,
  ringScale: number,
): AnnotationRect {
  const radialOffset = (options.gap ?? 22) * ringScale;
  const laneStep = side === "left" || side === "right"
    ? options.labelHeight + 8
    : Math.round(options.labelWidth * 0.55);
  if (side === "right") {
    return {
      x: anchor.x + radialOffset,
      y: anchor.y - options.labelHeight / 2 + laneOffset * laneStep,
      width: options.labelWidth,
      height: options.labelHeight,
    };
  }
  if (side === "left") {
    return {
      x: anchor.x - radialOffset - options.labelWidth,
      y: anchor.y - options.labelHeight / 2 + laneOffset * laneStep,
      width: options.labelWidth,
      height: options.labelHeight,
    };
  }
  if (side === "top") {
    return {
      x: anchor.x - options.labelWidth / 2 + laneOffset * laneStep,
      y: anchor.y - radialOffset - options.labelHeight,
      width: options.labelWidth,
      height: options.labelHeight,
    };
  }
  return {
    x: anchor.x - options.labelWidth / 2 + laneOffset * laneStep,
    y: anchor.y + radialOffset,
    width: options.labelWidth,
    height: options.labelHeight,
  };
}

function calloutLeaderFor(
  side: Side,
  anchor: AnnotationAnchor,
  label: AnnotationRect,
): Array<Point> {
  if (side === "right") {
    const edge = {
      x: label.x,
      y: clamp(anchor.y, label.y + LEADER_EDGE_INSET, label.y + label.height - LEADER_EDGE_INSET),
    };
    return [{ x: anchor.x, y: anchor.y }, { x: edge.x, y: anchor.y }, edge];
  }
  if (side === "left") {
    const edge = {
      x: label.x + label.width,
      y: clamp(anchor.y, label.y + LEADER_EDGE_INSET, label.y + label.height - LEADER_EDGE_INSET),
    };
    return [{ x: anchor.x, y: anchor.y }, { x: edge.x, y: anchor.y }, edge];
  }
  if (side === "top") {
    const edge = {
      x: clamp(anchor.x, label.x + LEADER_EDGE_INSET, label.x + label.width - LEADER_EDGE_INSET),
      y: label.y + label.height,
    };
    return [{ x: anchor.x, y: anchor.y }, { x: anchor.x, y: edge.y }, edge];
  }
  const edge = {
    x: clamp(anchor.x, label.x + LEADER_EDGE_INSET, label.x + label.width - LEADER_EDGE_INSET),
    y: label.y,
  };
  return [{ x: anchor.x, y: anchor.y }, { x: anchor.x, y: edge.y }, edge];
}

export function layoutPerimeterAnnotations(
  anchors: AnnotationAnchor[],
  options: AnnotationLayoutOptions,
): AnnotationPlacement[] {
  const reserved = options.reserved ?? [];
  const maxVisible = Math.max(0, options.maxVisible ?? anchors.length);
  const ordered = [...anchors].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
  const placed: AnnotationPlacement[] = [];

  for (const anchor of ordered.slice(0, maxVisible)) {
    const candidates = PERIMETER_SIDES.map((side) => {
      const label = candidateFor(side, anchor, options);
      const leader = leaderFor(side, anchor, label);
      const labelCollision = [...reserved, ...placed.map((item) => item.label)].reduce((sum, rect) => sum + overlap(label, rect), 0);
      const crossingPenalty = placed.reduce((sum, item) => {
        const crosses = segmentsCross(leader[0]!, leader[1]!, item.leader[0]!, item.leader[1]!) || segmentsCross(leader[1]!, leader[2]!, item.leader[1]!, item.leader[2]!);
        return sum + (crosses ? 100000 : 0);
      }, 0);
      const distance = Math.hypot(anchor.x - (label.x + label.width / 2), anchor.y - (label.y + label.height / 2));
      return { side, label, leader, score: labelCollision * 10000 + crossingPenalty + distance };
    });
    candidates.sort((a, b) => a.score - b.score || PERIMETER_SIDES.indexOf(a.side) - PERIMETER_SIDES.indexOf(b.side));
    const best = candidates[0]!;
    placed.push({
      ...anchor,
      label: best.label,
      leader: best.leader,
      side: best.side,
      slot: { side: best.side, laneOffset: 0, ringScale: 1 },
    });
  }
  return placed;
}

/* -------------------------------------------------------------------------- */
/* Point markers (plant tag pucks)                                            */
/* -------------------------------------------------------------------------- */

/** Which displacement candidate a marker landed on. `dirIndex: -1` = in place. */
export interface MarkerSlot {
  dirIndex: number;
  ringIndex: number;
}

export interface MarkerLayoutOptions {
  width: number;
  height: number;
  /** Marker diameter in px — markers are circles in a square bounding box. */
  size: number;
  padding?: number;
  /** Clearance required between two marker boxes, px. */
  minGap?: number;
  reserved?: AnnotationRect[];
  /** Hard cap on drawn markers; anything past it comes back `hidden`. */
  maxVisible?: number;
  previous?: ReadonlyMap<string, MarkerSlot>;
}

export interface MarkerPlacement extends AnnotationAnchor {
  /** Final marker centre — equal to the anchor unless displaced. */
  markerX: number;
  markerY: number;
  /** Anchor → marker-edge leader. Empty when the marker sits in place. */
  leader: Point[];
  displaced: boolean;
  /** True when no free slot existed — drop the label rather than stack it. */
  hidden: boolean;
  slot: MarkerSlot;
}

/** Eight compass directions, cardinals first so displacement reads deliberate. */
const MARKER_DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0.7071, y: -0.7071 },
  { x: 0.7071, y: 0.7071 },
  { x: -0.7071, y: 0.7071 },
  { x: -0.7071, y: -0.7071 },
];

const MARKER_RING_ORDER = [1.15, 1.95, 2.75] as const;
const STICKY_MARKER_BONUS = 220;

/** The square a marker occupies, inflated by half the required clearance. */
export function markerRect(
  placement: Pick<MarkerPlacement, "markerX" | "markerY">,
  size: number,
  gap = 0,
): AnnotationRect {
  const side = size + gap;
  return {
    x: placement.markerX - side / 2,
    y: placement.markerY - side / 2,
    width: side,
    height: side,
  };
}

/**
 * Lay out point markers (the plant tag pucks) so they stop stacking where
 * planting clusters.
 *
 * A marker prefers its true position; when that collides it walks out along a
 * compass ring and keeps a leader back to the real point, which is what makes
 * displacement honest on a survey-grade plan — the puck is a label, and the
 * leader preserves the position it labels. When no ring slot is free the marker
 * is reported `hidden` rather than drawn on top of a neighbour, because a
 * stack of overlapping codes conveys less than one legible code.
 */
export function layoutPointMarkers(
  anchors: AnnotationAnchor[],
  options: MarkerLayoutOptions,
): MarkerPlacement[] {
  const reserved = options.reserved ?? [];
  const gap = options.minGap ?? 3;
  const padding = options.padding ?? 4;
  const half = options.size / 2;
  const maxVisible = Math.max(0, options.maxVisible ?? anchors.length);
  const ordered = [...anchors].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id),
  );

  const placed: MarkerPlacement[] = [];
  const placedRects: AnnotationRect[] = [];
  const out: MarkerPlacement[] = [];

  for (const anchor of ordered) {
    const prior = options.previous?.get(anchor.id);
    const candidates: Array<{
      x: number;
      y: number;
      slot: MarkerSlot;
      collision: number;
      score: number;
    }> = [];

    const consider = (x: number, y: number, slot: MarkerSlot, ringIndex: number) => {
      const cx = clamp(x, padding + half, Math.max(padding + half, options.width - padding - half));
      const cy = clamp(y, padding + half, Math.max(padding + half, options.height - padding - half));
      const rect = markerRect({ markerX: cx, markerY: cy }, options.size, gap);
      const placedOverlap = placedRects.reduce((sum, item) => sum + overlap(rect, item), 0);
      const reservedOverlap = reserved.reduce((sum, item) => sum + overlap(rect, item), 0);
      const displacement = Math.hypot(cx - anchor.x, cy - anchor.y);
      let stickiness = 0;
      if (prior && prior.dirIndex === slot.dirIndex && prior.ringIndex === slot.ringIndex) {
        stickiness -= STICKY_MARKER_BONUS;
      }
      candidates.push({
        x: cx,
        y: cy,
        slot,
        collision: placedOverlap + reservedOverlap,
        score:
          placedOverlap * 12000 +
          reservedOverlap * 9000 +
          displacement * 6 +
          ringIndex * 30 +
          stickiness,
      });
    };

    consider(anchor.x, anchor.y, { dirIndex: -1, ringIndex: 0 }, 0);
    for (let ringIndex = 0; ringIndex < MARKER_RING_ORDER.length; ringIndex++) {
      const radius = options.size * MARKER_RING_ORDER[ringIndex]!;
      for (let dirIndex = 0; dirIndex < MARKER_DIRECTIONS.length; dirIndex++) {
        const dir = MARKER_DIRECTIONS[dirIndex]!;
        consider(
          anchor.x + dir.x * radius,
          anchor.y + dir.y * radius,
          { dirIndex, ringIndex },
          ringIndex + 1,
        );
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0]!;
    const displaced = best.slot.dirIndex >= 0;
    const hidden = best.collision > 0 || placed.length >= maxVisible;
    const placement: MarkerPlacement = {
      ...anchor,
      markerX: best.x,
      markerY: best.y,
      leader: displaced && !hidden ? [{ x: anchor.x, y: anchor.y }, leaderTip(anchor, best, half)] : [],
      displaced,
      hidden,
      slot: best.slot,
    };
    out.push(placement);
    if (!hidden) {
      placed.push(placement);
      placedRects.push(markerRect(placement, options.size, gap));
    }
  }

  return out;
}

/** Where the leader meets the puck: on its rim, aimed back at the true point. */
function leaderTip(
  anchor: Point,
  marker: { x: number; y: number },
  half: number,
): Point {
  const dx = anchor.x - marker.x;
  const dy = anchor.y - marker.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: marker.x + (dx / length) * half, y: marker.y + (dy / length) * half };
}

export function layoutCalloutAnnotations(
  anchors: AnnotationAnchor[],
  options: AnnotationLayoutOptions,
): AnnotationPlacement[] {
  const reserved = options.reserved ?? [];
  const maxVisible = Math.max(0, options.maxVisible ?? anchors.length);
  const ordered = [...anchors].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id),
  );
  const visible = ordered.slice(0, maxVisible);
  const placed: AnnotationPlacement[] = [];

  for (const anchor of visible) {
    const sideOrder = sideOrderForAnchor(anchor, options);
    const prior = options.previous?.get(anchor.id);
    const candidates: Array<{
      side: Side;
      label: AnnotationRect;
      leader: Point[];
      slot: AnnotationSlot;
      score: number;
    }> = [];
    for (let sideIndex = 0; sideIndex < sideOrder.length; sideIndex++) {
      const side = sideOrder[sideIndex]!;
      for (let ringIndex = 0; ringIndex < CALLOUT_RING_ORDER.length; ringIndex++) {
        const ringScale = CALLOUT_RING_ORDER[ringIndex]!;
        for (let laneIndex = 0; laneIndex < CALLOUT_LANE_ORDER.length; laneIndex++) {
          const laneOffset = CALLOUT_LANE_ORDER[laneIndex]!;
          const rawRect = calloutCandidate(side, anchor, options, laneOffset, ringScale);
          const { label, shift } = clampRect(rawRect, options);
          const leader = calloutLeaderFor(side, anchor, label);
          const placedOverlap = placed.reduce((sum, item) => sum + overlap(label, item.label), 0);
          const reservedOverlap = reserved.reduce((sum, rect) => sum + overlap(label, rect), 0);
          const anchorOcclusion = visible.reduce((sum, other) => {
            if (other.id === anchor.id) return sum;
            return sum + (pointInside(label, { x: other.x, y: other.y }) ? 1 : 0);
          }, 0);
          const crossingPenalty = leaderCrossings(leader, placed);
          const distance = Math.hypot(
            anchor.x - (label.x + label.width / 2),
            anchor.y - (label.y + label.height / 2),
          );
          let stickiness = 0;
          if (prior && prior.side === side) {
            stickiness -=
              prior.laneOffset === laneOffset && prior.ringScale === ringScale
                ? STICKY_SLOT_BONUS
                : STICKY_SIDE_BONUS;
          }
          const score =
            placedOverlap * 12000 +
            reservedOverlap * 18000 +
            anchorOcclusion * 8000 +
            crossingPenalty * 2400 +
            distance +
            shift * 90 +
            ringIndex * 35 +
            Math.abs(laneOffset) * 18 +
            sideIndex * 8 +
            stickiness;
          candidates.push({
            side,
            label,
            leader,
            slot: { side, laneOffset, ringScale },
            score,
          });
        }
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    if (!best) continue;
    placed.push({
      ...anchor,
      label: best.label,
      leader: best.leader,
      side: best.side,
      slot: best.slot,
    });
  }

  return placed;
}

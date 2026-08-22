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

export interface AnnotationLayoutOptions {
  width: number;
  height: number;
  labelWidth: number;
  labelHeight: number;
  padding?: number;
  gap?: number;
  reserved?: AnnotationRect[];
  maxVisible?: number;
}

export interface AnnotationPlacement extends AnnotationAnchor {
  label: AnnotationRect;
  leader: Array<{ x: number; y: number }>;
  side: "top" | "right" | "bottom" | "left";
}

type Side = AnnotationPlacement["side"];
type Point = { x: number; y: number };

const PERIMETER_SIDES: Side[] = ["top", "right", "bottom", "left"];
const CALLOUT_LANE_ORDER = [0, -1, 1, -2, 2] as const;
const CALLOUT_RING_ORDER = [1, 1.4, 1.8] as const;
const LEADER_EDGE_INSET = 4;

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
    placed.push({ ...anchor, label: best.label, leader: best.leader, side: best.side });
  }
  return placed;
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
    const candidates: Array<{
      side: Side;
      label: AnnotationRect;
      leader: Point[];
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
          const score =
            placedOverlap * 12000 +
            reservedOverlap * 18000 +
            anchorOcclusion * 8000 +
            crossingPenalty * 2400 +
            distance +
            shift * 90 +
            ringIndex * 35 +
            Math.abs(laneOffset) * 18 +
            sideIndex * 8;
          candidates.push({ side, label, leader, score });
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
    });
  }

  return placed;
}

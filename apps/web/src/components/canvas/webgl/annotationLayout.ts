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

function overlap(a: AnnotationRect, b: AnnotationRect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a1: { x: number; y: number }, a2: { x: number; y: number }, b1: { x: number; y: number }, b2: { x: number; y: number }): boolean {
  const ab = orientation(a1, a2, b1) * orientation(a1, a2, b2);
  const cd = orientation(b1, b2, a1) * orientation(b1, b2, a2);
  return ab < 0 && cd < 0;
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

export function layoutPerimeterAnnotations(
  anchors: AnnotationAnchor[],
  options: AnnotationLayoutOptions,
): AnnotationPlacement[] {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  const reserved = options.reserved ?? [];
  const maxVisible = Math.max(0, options.maxVisible ?? anchors.length);
  const ordered = [...anchors].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
  const placed: AnnotationPlacement[] = [];

  for (const anchor of ordered.slice(0, maxVisible)) {
    const candidates = sides.map((side) => {
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
    candidates.sort((a, b) => a.score - b.score || sides.indexOf(a.side) - sides.indexOf(b.side));
    const best = candidates[0]!;
    placed.push({ ...anchor, label: best.label, leader: best.leader, side: best.side });
  }
  return placed;
}

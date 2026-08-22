import { describe, expect, it } from "vitest";
import {
  layoutCalloutAnnotations,
  layoutPerimeterAnnotations,
  type AnnotationAnchor,
  type AnnotationRect,
} from "./annotationLayout";

function overlap(a: AnnotationRect, b: AnnotationRect): number {
  const x = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const y = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return x * y;
}

function totalOverlap(rects: AnnotationRect[]): number {
  let sum = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      sum += overlap(rects[i]!, rects[j]!);
    }
  }
  return sum;
}

function legacyStaticRects(
  anchors: AnnotationAnchor[],
  width: number,
  height: number,
): AnnotationRect[] {
  return anchors.map((anchor, idx) => {
    const dx = idx % 2 === 0 ? 76 : -76;
    const dy = idx % 3 === 0 ? -48 : 44;
    const centerX = Math.max(0, Math.min(width, anchor.x + dx));
    const centerY = Math.max(0, Math.min(height, anchor.y + dy));
    return {
      x: centerX - 56,
      y: centerY - 18,
      width: 112,
      height: 36,
    };
  });
}

describe("layoutPerimeterAnnotations", () => {
  const options = { width: 1000, height: 700, labelWidth: 160, labelHeight: 32, padding: 24 };

  it("places every annotation with a three-point leader", () => {
    const result = layoutPerimeterAnnotations([
      { id: "title", x: 420, y: 300 },
      { id: "easement", x: 700, y: 420 },
    ], options);
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.leader.length === 3)).toBe(true);
  });

  it("avoids reserved chrome and earlier labels when alternatives exist", () => {
    const result = layoutPerimeterAnnotations([
      { id: "a", x: 500, y: 40 },
      { id: "b", x: 520, y: 45 },
    ], {
      ...options,
      reserved: [{ x: 400, y: 0, width: 200, height: 80 }],
    });
    expect(result[0]!.label.y).toBeGreaterThanOrEqual(24);
    expect(result[1]!.label.x !== result[0]!.label.x || result[1]!.label.y !== result[0]!.label.y).toBe(true);
  });

  it("limits visible annotations by priority", () => {
    const result = layoutPerimeterAnnotations([
      { id: "low", x: 300, y: 300, priority: 1 },
      { id: "high", x: 700, y: 300, priority: 10 },
    ], { ...options, maxVisible: 1 });
    expect(result.map((item) => item.id)).toEqual(["high"]);
  });

  it("is deterministic", () => {
    const anchors = [{ id: "one", x: 10, y: 20 }, { id: "two", x: 900, y: 600 }];
    expect(layoutPerimeterAnnotations(anchors, options)).toEqual(layoutPerimeterAnnotations(anchors, options));
  });
});

describe("layoutCalloutAnnotations", () => {
  const options = {
    width: 1000,
    height: 700,
    labelWidth: 112,
    labelHeight: 36,
    padding: 14,
    gap: 20,
  };

  const clusteredAnchors: AnnotationAnchor[] = [
    { id: "a", x: 500, y: 350 },
    { id: "b", x: 510, y: 355 },
    { id: "c", x: 495, y: 344 },
    { id: "d", x: 520, y: 362 },
    { id: "e", x: 487, y: 357 },
    { id: "f", x: 505, y: 338 },
  ];

  it("beats legacy static offsets in clustered anchors (negative control)", () => {
    const legacy = legacyStaticRects(clusteredAnchors, options.width, options.height);
    const modern = layoutCalloutAnnotations(clusteredAnchors, options);
    const legacyOverlap = totalOverlap(legacy);
    const modernOverlap = totalOverlap(modern.map((item) => item.label));

    // Negative control: the retired offset recipe demonstrably jams.
    expect(legacyOverlap).toBeGreaterThan(0);
    expect(modernOverlap).toBeLessThan(legacyOverlap);
  });

  it("anchors leaders to real points and clamps labels to viewport", () => {
    const placements = layoutCalloutAnnotations(clusteredAnchors, options);
    for (const placement of placements) {
      const start = placement.leader[0]!;
      const tip = placement.leader[placement.leader.length - 1]!;
      expect(start.x).toBeCloseTo(placement.x, 6);
      expect(start.y).toBeCloseTo(placement.y, 6);

      const onVerticalEdge =
        Math.abs(tip.x - placement.label.x) < 0.0001 ||
        Math.abs(tip.x - (placement.label.x + placement.label.width)) < 0.0001;
      const onHorizontalEdge =
        Math.abs(tip.y - placement.label.y) < 0.0001 ||
        Math.abs(tip.y - (placement.label.y + placement.label.height)) < 0.0001;
      expect(onVerticalEdge || onHorizontalEdge).toBe(true);

      expect(placement.label.x).toBeGreaterThanOrEqual(options.padding);
      expect(placement.label.y).toBeGreaterThanOrEqual(options.padding);
      expect(placement.label.x + placement.label.width).toBeLessThanOrEqual(
        options.width - options.padding,
      );
      expect(placement.label.y + placement.label.height).toBeLessThanOrEqual(
        options.height - options.padding,
      );
    }
  });

  it("is deterministic for repeated runs", () => {
    expect(layoutCalloutAnnotations(clusteredAnchors, options)).toEqual(
      layoutCalloutAnnotations(clusteredAnchors, options),
    );
  });
});

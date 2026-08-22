import { describe, expect, it } from "vitest";
import {
  layoutCalloutAnnotations,
  layoutPerimeterAnnotations,
  layoutPointMarkers,
  markerRect,
  type AnnotationAnchor,
  type AnnotationRect,
  type AnnotationSlot,
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

  it("avoids reserved rects handed in from other annotation families", () => {
    const dimensionChip: AnnotationRect = { x: 560, y: 330, width: 190, height: 18 };
    const placements = layoutCalloutAnnotations(clusteredAnchors, {
      ...options,
      reserved: [dimensionChip],
    });
    for (const placement of placements) {
      expect(
        overlap(placement.label, dimensionChip),
        `${placement.id} landed on the dimension chip`,
      ).toBe(0);
    }
  });

  describe("hysteresis", () => {
    /** Camera drift: every anchor moves by the same small delta. */
    const drift = (anchors: AnnotationAnchor[], dx: number, dy: number) =>
      anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }));

    const slotsOf = (placements: ReturnType<typeof layoutCalloutAnnotations>) =>
      new Map(placements.map((p) => [p.id, p.slot]));

    it("keeps its slot under sub-pixel drift when a prior slot is supplied", () => {
      const first = layoutCalloutAnnotations(clusteredAnchors, options);
      const previous = slotsOf(first);
      const drifted = layoutCalloutAnnotations(drift(clusteredAnchors, 0.4, -0.3), {
        ...options,
        previous,
      });
      for (const placement of drifted) {
        expect(placement.slot, `${placement.id} changed slot under drift`).toEqual(
          previous.get(placement.id),
        );
      }
    });

    /**
     * Zoom, not pan, is the churn driver. Panning moves every anchor by the same
     * delta, so every candidate score shifts identically and nothing flips —
     * the `drift` case above is stable even without stickiness. Zooming changes
     * the SPACING between anchors, which makes labels stop overlapping at
     * different moments and walks anchors across the viewport midline that
     * `sideOrderForAnchor` keys off. That is when lanes flip.
     */
    const spread = (anchors: AnnotationAnchor[], k: number) =>
      anchors.map((a) => ({
        ...a,
        x: 500 + (a.x - 500) * k,
        y: 350 + (a.y - 350) * k,
      }));

    const churnOverZoom = (sticky: boolean) => {
      let changes = 0;
      let previous = slotsOf(
        layoutCalloutAnnotations(spread(clusteredAnchors, 1), options),
      );
      for (let step = 1; step <= 40; step++) {
        const next = layoutCalloutAnnotations(
          spread(clusteredAnchors, 1 + step * 0.35),
          sticky ? { ...options, previous } : options,
        );
        for (const placement of next) {
          const before = previous.get(placement.id);
          if (JSON.stringify(placement.slot) !== JSON.stringify(before)) changes += 1;
        }
        previous = slotsOf(next);
      }
      return changes;
    };

    it("cuts slot churn across a zoom sweep (negative control)", () => {
      const stateless = churnOverZoom(false);
      const sticky = churnOverZoom(true);
      // Negative control: without a prior slot the solver demonstrably churns.
      expect(stateless).toBeGreaterThan(0);
      expect(sticky).toBeLessThan(stateless);
    });

    it("still moves when the sticky slot genuinely collides", () => {
      const anchors: AnnotationAnchor[] = [{ id: "solo", x: 500, y: 350 }];
      const first = layoutCalloutAnnotations(anchors, options);
      const slot = first[0]!.slot;
      // Reserve exactly where it sat: overlap weights dwarf the sticky bonus.
      const blocked = layoutCalloutAnnotations(anchors, {
        ...options,
        previous: new Map<string, AnnotationSlot>([["solo", slot]]),
        reserved: [first[0]!.label],
      });
      expect(overlap(blocked[0]!.label, first[0]!.label)).toBe(0);
    });
  });
});

describe("layoutPointMarkers", () => {
  const options = { width: 800, height: 600, size: 24, minGap: 3 };

  /** Six pucks inside one 20 px blob — the planting-cluster case. */
  const cluster: AnnotationAnchor[] = [
    { id: "p1", x: 400, y: 300 },
    { id: "p2", x: 406, y: 303 },
    { id: "p3", x: 396, y: 297 },
    { id: "p4", x: 410, y: 308 },
    { id: "p5", x: 392, y: 305 },
    { id: "p6", x: 402, y: 294 },
  ];

  const visibleRects = (placements: ReturnType<typeof layoutPointMarkers>) =>
    placements.filter((p) => !p.hidden).map((p) => markerRect(p, options.size));

  it("stops pucks stacking, unlike drawing them at the raw point (negative control)", () => {
    // Negative control: the retired behaviour drew every puck at its projected
    // point with a fixed -12px margin, so a cluster simply piled up.
    const rawStack = cluster.map((a) => markerRect({ markerX: a.x, markerY: a.y }, options.size));
    expect(totalOverlap(rawStack)).toBeGreaterThan(0);

    const placed = layoutPointMarkers(cluster, options);
    expect(totalOverlap(visibleRects(placed))).toBe(0);
  });

  it("keeps a leader back to the true point whenever it displaces a puck", () => {
    const placed = layoutPointMarkers(cluster, options);
    const displaced = placed.filter((p) => p.displaced && !p.hidden);
    expect(displaced.length).toBeGreaterThan(0);
    for (const placement of displaced) {
      expect(placement.leader).toHaveLength(2);
      // The leader starts at the real position it labels — that is what makes
      // displacement honest on a survey-grade plan.
      expect(placement.leader[0]!.x).toBeCloseTo(placement.x, 6);
      expect(placement.leader[0]!.y).toBeCloseTo(placement.y, 6);
    }
  });

  it("leaves an uncrowded puck exactly on its point with no leader", () => {
    const placed = layoutPointMarkers(
      [
        { id: "lonely", x: 200, y: 150 },
        { id: "far", x: 600, y: 450 },
      ],
      options,
    );
    for (const placement of placed) {
      expect(placement.displaced).toBe(false);
      expect(placement.leader).toEqual([]);
      expect(placement.markerX).toBeCloseTo(placement.x, 6);
      expect(placement.markerY).toBeCloseTo(placement.y, 6);
    }
  });

  it("avoids reserved chrome rather than drawing under it", () => {
    const dock: AnnotationRect = { x: 380, y: 280, width: 200, height: 160 };
    const placed = layoutPointMarkers(cluster, { ...options, reserved: [dock] });
    for (const rect of visibleRects(placed)) {
      expect(overlap(rect, dock)).toBe(0);
    }
  });

  it("hides rather than stacks when no ring slot is free", () => {
    const boxed: AnnotationAnchor[] = Array.from({ length: 12 }).map((_, i) => ({
      id: `q${i}`,
      x: 40 + (i % 4),
      y: 40 + Math.floor(i / 4),
    }));
    const placed = layoutPointMarkers(boxed, {
      ...options,
      width: 120,
      height: 120,
    });
    expect(placed.some((p) => p.hidden)).toBe(true);
    expect(totalOverlap(visibleRects(placed))).toBe(0);
  });

  it("is deterministic and clamps markers inside the viewport", () => {
    expect(layoutPointMarkers(cluster, options)).toEqual(
      layoutPointMarkers(cluster, options),
    );
    const edge = layoutPointMarkers([{ id: "corner", x: 2, y: 2 }], options);
    expect(edge[0]!.markerX).toBeGreaterThanOrEqual(options.size / 2);
    expect(edge[0]!.markerY).toBeGreaterThanOrEqual(options.size / 2);
  });
});

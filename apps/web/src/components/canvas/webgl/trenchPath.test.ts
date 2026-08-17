import { describe, expect, it } from "vitest";
import type { CanvasGroundScale } from "@workstream/domain";
import {
  buildTracedTrench,
  shouldAppendTrenchPoint,
  trenchConflictsWithRings,
  trenchLengthM,
  TRENCH_DEPTH_MM,
} from "./trenchPath";

const SCALE: CanvasGroundScale = {
  metresPerXPx: 0.1,
  metresPerYPx: 0.1,
  canvasWidthPx: 100,
  canvasHeightPx: 100,
};

const SQUARE_RING = [
  { x: 40, y: 40 },
  { x: 60, y: 40 },
  { x: 60, y: 60 },
  { x: 40, y: 60 },
];

describe("shouldAppendTrenchPoint", () => {
  it("ignores sub-threshold travel", () => {
    expect(shouldAppendTrenchPoint({ x: 0, y: 0 }, { x: 0.1, y: 0 })).toBe(false);
  });

  it("appends past the threshold", () => {
    expect(shouldAppendTrenchPoint({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

describe("trenchConflictsWithRings", () => {
  it("flags a vertex inside a no-dig ring", () => {
    expect(trenchConflictsWithRings([{ x: 50, y: 50 }], [SQUARE_RING])).toBe(true);
  });

  it("passes a path fully outside", () => {
    expect(trenchConflictsWithRings([{ x: 10, y: 10 }], [SQUARE_RING])).toBe(false);
  });

  it("ignores degenerate (open) rings", () => {
    const open = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(trenchConflictsWithRings([{ x: 50, y: 50 }], [open])).toBe(false);
  });
});

describe("trenchLengthM", () => {
  it("measures a horizontal run in metres", () => {
    // 100% wide canvas at 0.1 m/px = 10 m across.
    expect(
      trenchLengthM(
        [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
        SCALE,
      ),
    ).toBeCloseTo(10, 4);
  });
});

describe("buildTracedTrench", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("emits a committed traced trench with per-kind depth", () => {
    const t = buildTracedTrench({
      id,
      name: "Drain run",
      kind: "drainage",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    expect(t.source).toBe("traced");
    expect(t.ghost).toBeUndefined();
    expect(t.depth_mm).toBe(TRENCH_DEPTH_MM.drainage);
    expect(t.points).toEqual([
      { x_pct: 0, y_pct: 0 },
      { x_pct: 50, y_pct: 0 },
    ]);
  });

  it("honours an explicit depth override", () => {
    const t = buildTracedTrench({
      id,
      name: "Shallow lateral",
      kind: "irrig_lateral",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      depthMm: 150,
    });
    expect(t.depth_mm).toBe(150);
  });
});

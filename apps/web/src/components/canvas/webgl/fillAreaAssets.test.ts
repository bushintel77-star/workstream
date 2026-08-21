import { describe, expect, it } from "vitest";
import {
  MAX_AREA_PLANTS,
  gridInBox,
  rowAlongLine,
  rowHint,
  rowRotationDeg,
  rowSpacingM,
  segmentLengthM,
} from "./fillAreaAssets";
import { pctToWorld, type PctPoint } from "./coordTransform";

/** Consecutive centre-to-centre distances in true world metres. */
function worldGaps(
  pts: PctPoint[],
  scaleM: number,
  boardAspect: number,
): number[] {
  const world = pts.map((p) => pctToWorld(p, scaleM, boardAspect));
  const gaps: number[] = [];
  for (let i = 1; i < world.length; i++) {
    gaps.push(
      Math.hypot(world[i]![0] - world[i - 1]![0], world[i]![1] - world[i - 1]![1]),
    );
  }
  return gaps;
}

describe("gridInBox", () => {
  it("fills a box at the requested spacing", () => {
    const pts = gridInBox(
      { x: 10, y: 10 },
      { x: 40, y: 40 },
      3,
      30,
      1,
    );
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.every((p) => p.x >= 10 && p.x <= 40)).toBe(true);
    expect(pts.every((p) => p.y >= 10 && p.y <= 40)).toBe(true);
  });

  it("caps runaway fills", () => {
    const pts = gridInBox({ x: 0, y: 0 }, { x: 100, y: 100 }, 0.2, 40, 1);
    expect(pts.length).toBe(MAX_AREA_PLANTS);
  });

  it("always yields at least the box centre when the box is a click", () => {
    const pts = gridInBox({ x: 50, y: 50 }, { x: 50.1, y: 50.1 }, 4, 30, 1);
    expect(pts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("segmentLengthM", () => {
  it("measures in true metres, honouring the board's Y stretch", () => {
    // 40 m across the board width; boardAspect 2 → 80 m down its height.
    // A pure-Y run of 50% is therefore 40 m, not 20 m.
    expect(segmentLengthM({ x: 0, y: 0 }, { x: 50, y: 0 }, 40, 2)).toBeCloseTo(20, 9);
    expect(segmentLengthM({ x: 0, y: 0 }, { x: 0, y: 50 }, 40, 2)).toBeCloseTo(40, 9);
  });
});

describe("rowAlongLine", () => {
  it("includes both endpoints", () => {
    const a = { x: 20, y: 30 };
    const b = { x: 70, y: 30 };
    const pts = rowAlongLine(a, b, 3, 40, 1);
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
  });

  /**
   * The anisotropy trap: percent space stretches Y by boardAspect, so a
   * diagonal run interpolated in percent must still come out evenly spaced
   * in metres, and the stem count must come from the metre length.
   */
  it("spaces a diagonal evenly in world metres on a non-square board", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 60, y: 40 };
    const scaleM = 40;
    const boardAspect = 2;
    const pts = rowAlongLine(a, b, 4, scaleM, boardAspect);

    const gaps = worldGaps(pts, scaleM, boardAspect);
    expect(gaps.length).toBeGreaterThan(4);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 9);
    // Never sparser than the requested spacing.
    expect(gaps[0]!).toBeLessThanOrEqual(4 + 1e-9);
    expect(rowSpacingM(a, b, pts.length, scaleM, boardAspect)).toBeCloseTo(
      gaps[0]!,
      9,
    );
  });

  it("counts stems from the metre length, not the percent length", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 60, y: 40 };
    const scaleM = 40;
    const boardAspect = 2;
    // True metre length: hypot(50 * 0.4, 30 * 0.8) = 31.24 m → 8 gaps at 4 m.
    expect(segmentLengthM(a, b, scaleM, boardAspect)).toBeCloseTo(31.241, 3);
    expect(rowAlongLine(a, b, 4, scaleM, boardAspect)).toHaveLength(9);
    // The naive percent reading (both axes at the X scale) is 23.32 m, which
    // would have planted 7 stems — one short of a closed hedge.
    const naiveLengthM = Math.hypot(50, 30) * (scaleM / 100);
    expect(Math.ceil(naiveLengthM / 4) + 1).toBe(7);
  });

  it("caps a runaway run and keeps it evenly spaced", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 100 };
    const pts = rowAlongLine(a, b, 0.05, 60, 1);
    expect(pts).toHaveLength(MAX_AREA_PLANTS);
    const gaps = worldGaps(pts, 60, 1);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 9);
  });

  it("yields a single stem for a click (zero-length run)", () => {
    expect(rowAlongLine({ x: 50, y: 50 }, { x: 50, y: 50 }, 2, 30, 1)).toEqual([
      { x: 50, y: 50 },
    ]);
  });

  it("falls back to a sane spacing when none is catalogued", () => {
    const pts = rowAlongLine({ x: 0, y: 0 }, { x: 50, y: 0 }, Number.NaN, 40, 1);
    expect(pts.length).toBeGreaterThan(1);
    expect(rowSpacingM({ x: 0, y: 0 }, { x: 50, y: 0 }, pts.length, 40, 1))
      .toBeLessThanOrEqual(1.2 + 1e-9);
  });
});

describe("rowRotationDeg", () => {
  it("aligns an oriented symbol along the run", () => {
    // Due +x in world: no rotation. Due +y in board (= +z world): 270°.
    expect(rowRotationDeg({ x: 0, y: 0 }, { x: 50, y: 0 }, 40, 1)).toBeCloseTo(0, 9);
    expect(rowRotationDeg({ x: 0, y: 0 }, { x: 0, y: 50 }, 40, 1)).toBeCloseTo(270, 9);
  });

  it("takes the bearing in metre space, not percent space", () => {
    // A 45° percent diagonal is 63.4° in world metres when boardAspect = 2.
    expect(rowRotationDeg({ x: 0, y: 0 }, { x: 10, y: 10 }, 40, 1)).toBeCloseTo(315, 9);
    expect(rowRotationDeg({ x: 0, y: 0 }, { x: 10, y: 10 }, 40, 2)).toBeCloseTo(
      296.565,
      3,
    );
  });

  it("is zero for a degenerate run", () => {
    expect(rowRotationDeg({ x: 5, y: 5 }, { x: 5, y: 5 }, 40, 1)).toBe(0);
  });
});

describe("rowHint", () => {
  it("reports the realised spacing in metres", () => {
    expect(rowHint(6, 1.25)).toBe("Row · 6 stems · 1.25 m centres");
    expect(rowHint(1, 0)).toBe("Row · 1 stem");
  });
});

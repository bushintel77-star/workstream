import { describe, expect, it } from "vitest";
import {
  buildTracedLightingRun,
  fixtureCountForRun,
  fixturePositionsWorld,
  lightingRunLengthM,
  shouldAppendLightingPoint,
} from "./lightingPath";

// 10 m wide × 10 m tall board (scaleM 10, aspect 1) → 1% = 0.1 m.
const SCALE_M = 10;
const ASPECT = 1;

// 25%..75% horizontal run = 5 m.
const RUN = [
  { x: 25, y: 25 },
  { x: 75, y: 25 },
];

describe("shouldAppendLightingPoint", () => {
  it("ignores sub-threshold travel and appends past it", () => {
    expect(shouldAppendLightingPoint({ x: 0, y: 0 }, { x: 0.1, y: 0 })).toBe(false);
    expect(shouldAppendLightingPoint({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

describe("lightingRunLengthM", () => {
  it("measures an open run without closing it", () => {
    expect(lightingRunLengthM(RUN, SCALE_M, ASPECT)).toBeCloseTo(5, 4);
  });

  it("returns zero for a single point", () => {
    expect(lightingRunLengthM([{ x: 25, y: 25 }], SCALE_M, ASPECT)).toBe(0);
  });
});

describe("fixtureCountForRun", () => {
  it("lights both ends of the run (floor(L/s) + 1)", () => {
    expect(fixtureCountForRun(10, 2.5)).toBe(5);
    expect(fixtureCountForRun(9.9, 2.5)).toBe(4);
  });

  it("returns zero when the run or spacing is degenerate", () => {
    expect(fixtureCountForRun(0, 2.5)).toBe(0);
    expect(fixtureCountForRun(10, 0)).toBe(0);
  });
});

describe("fixturePositionsWorld", () => {
  it("drops a fixture every spacing from the start, ending at the run end", () => {
    // 0%..100% horizontal run = 10 m.
    const run = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];
    const pts = fixturePositionsWorld(run, 2.5, SCALE_M, ASPECT);
    expect(pts).toHaveLength(5);
    expect(pts[0]![0]).toBeCloseTo(-5, 6); // lot-centred: 0% → -5 m
    expect(pts[4]![0]).toBeCloseTo(5, 6); // 100% → +5 m
  });

  it("yields no fixtures for a degenerate run", () => {
    expect(fixturePositionsWorld([{ x: 0, y: 0 }], 2.5, SCALE_M, ASPECT)).toEqual([]);
  });
});

describe("buildTracedLightingRun", () => {
  const id = "33333333-3333-4333-8333-333333333333";

  it("commits an open lighting run with contract defaults", () => {
    const z = buildTracedLightingRun({ id, name: "Path lights", points: RUN });
    expect(z.kind).toBe("lighting");
    expect(z.points).toHaveLength(2); // open — never closed into a ring
    expect(z.fixture_spacing_m).toBe(2.5);
    expect(z.wire_gauge).toBe("12/2");
  });

  it("honours explicit fixture spacing", () => {
    const z = buildTracedLightingRun({
      id,
      name: "Spike lights",
      points: RUN,
      fixtureSpacingM: 3,
    });
    expect(z.fixture_spacing_m).toBe(3);
  });
});

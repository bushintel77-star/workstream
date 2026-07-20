import { describe, expect, it } from "vitest";
import { interpretSketchStrokesToCad } from "./sketch-to-cad";

const boundary = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];
const building = [
  { x: 35, y: 30 },
  { x: 65, y: 30 },
  { x: 65, y: 50 },
  { x: 35, y: 50 },
];

describe("interpretSketchStrokesToCad", () => {
  it("maps a closed rear mass to deck", () => {
    const strokes = [
      {
        id: "s1",
        points: [
          { x: 40, y: 55 },
          { x: 60, y: 55 },
          { x: 60, y: 72 },
          { x: 40, y: 72 },
          { x: 41, y: 56 },
        ],
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g).toHaveLength(1);
    expect(g[0]!.symbol_id).toBe("deck");
    expect(g[0]!.y_pct).toBeGreaterThan(50);
  });

  it("maps a long boundary line to hedge", () => {
    const strokes = [
      {
        id: "s2",
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 22 + i * 0.2,
          y: 25 + i * 4,
        })),
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g[0]!.symbol_id).toBe("hedge");
  });

  it("maps a west compact mark to shade canopy", () => {
    const strokes = [
      {
        id: "s3",
        points: [
          { x: 28, y: 58 },
          { x: 30, y: 59 },
          { x: 29, y: 61 },
        ],
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g[0]!.symbol_id).toBe("canopy");
    expect(g[0]!.reason.toLowerCase()).toMatch(/shade|canopy/);
  });

  it("returns empty for empty or tiny strokes", () => {
    expect(interpretSketchStrokesToCad([], { boundary, building })).toEqual([]);
    expect(
      interpretSketchStrokesToCad(
        [{ id: "x", points: [{ x: 50, y: 50 }] }],
        { boundary, building },
      ),
    ).toEqual([]);
  });
});

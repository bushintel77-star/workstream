import { describe, expect, it } from "vitest";
import {
  interpretSketchStrokesToCad,
  SKETCH_CAD_SYMBOL_IDS,
} from "./sketch-to-cad";

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

  it("only emits ids from the published sketch vocabulary", () => {
    // The API allow-filter is built from SKETCH_CAD_SYMBOL_IDS — an id
    // outside it would be silently dropped and formalize would look broken.
    const vocab = new Set<string>(SKETCH_CAD_SYMBOL_IDS);
    const strokes = [
      // boundary line, drain line, path line, deck mass, lawn mass,
      // bed mass, west mark, east mark — exercises every branch.
      {
        id: "a",
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 22 + i * 0.2,
          y: 25 + i * 4,
        })),
      },
      {
        id: "b",
        points: Array.from({ length: 10 }, (_, i) => ({
          x: 38 + i * 2.4,
          y: 62 + (i % 2) * 0.4,
        })),
      },
      {
        id: "c",
        points: Array.from({ length: 10 }, (_, i) => ({
          x: 40 + i * 2.2,
          y: 34 + (i % 2) * 0.4,
        })),
      },
      {
        id: "d",
        points: [
          { x: 40, y: 55 },
          { x: 60, y: 55 },
          { x: 60, y: 72 },
          { x: 40, y: 72 },
          { x: 41, y: 56 },
        ],
      },
      {
        id: "e",
        points: [
          { x: 30, y: 22 },
          { x: 44, y: 22 },
          { x: 44, y: 29 },
          { x: 30, y: 29 },
          { x: 30.5, y: 22.5 },
        ],
      },
      {
        id: "f",
        points: [
          { x: 28, y: 58 },
          { x: 30, y: 59 },
          { x: 29, y: 61 },
        ],
      },
      {
        id: "g",
        points: [
          { x: 70, y: 40 },
          { x: 71, y: 41 },
          { x: 70, y: 42 },
        ],
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g.length).toBe(strokes.length);
    for (const s of g) {
      expect(vocab.has(s.symbol_id), `unknown id ${s.symbol_id}`).toBe(true);
    }
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

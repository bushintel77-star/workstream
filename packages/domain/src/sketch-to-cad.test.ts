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

  it("maps a tightly-closed dot to a tree, not a planting bed", () => {
    // Regression: a small circle closes on itself (close-distance < 3%) and
    // used to hit the closed-mass branch → lomandra bed. A dot is a tree.
    const strokes = [
      {
        id: "dot",
        points: [
          { x: 28, y: 58 },
          { x: 29, y: 57.2 },
          { x: 30, y: 58 },
          { x: 29.6, y: 59 },
          { x: 28.4, y: 59 },
          { x: 28.1, y: 58.2 },
        ],
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g).toHaveLength(1);
    expect(g[0]!.symbol_id).toBe("canopy");
    expect(g[0]!.outlinePct).toBeUndefined();
  });

  it("attaches the drawn outline to a closed mass", () => {
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
    expect(g[0]!.outlinePct).toBeDefined();
    expect(g[0]!.outlinePct!.length).toBeGreaterThanOrEqual(3);
    expect(g[0]!.outlinePct!.length).toBeLessThanOrEqual(24);
    for (const p of g[0]!.outlinePct!) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it("omits the outline on linear strokes and marks", () => {
    const strokes = [
      {
        id: "line",
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 22 + i * 0.2,
          y: 25 + i * 4,
        })),
      },
      {
        id: "mark",
        points: [
          { x: 70, y: 40 },
          { x: 71, y: 41 },
          { x: 70, y: 42 },
        ],
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g).toHaveLength(2);
    for (const s of g) expect(s.outlinePct).toBeUndefined();
  });

  it("merges overlapping strokes (hatching) into one suggestion with a hull outline", () => {
    // Three closed strokes over the same rear area — double outline + infill.
    const rect = (dx: number, dy: number) => [
      { x: 40 + dx, y: 55 + dy },
      { x: 60 + dx, y: 55 + dy },
      { x: 60 + dx, y: 72 + dy },
      { x: 40 + dx, y: 72 + dy },
      { x: 41 + dx, y: 56 + dy },
    ];
    const strokes = [
      { id: "h1", points: rect(0, 0) },
      { id: "h2", points: rect(0.6, 0.4) },
      { id: "h3", points: rect(-0.4, 0.8) },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g).toHaveLength(1);
    expect(g[0]!.symbol_id).toBe("deck");
    expect(g[0]!.outlinePct).toBeDefined();
    expect(g[0]!.outlinePct!.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps a hedge next to a bed separate (adjacent, not overlapping)", () => {
    const strokes = [
      {
        id: "bed",
        points: [
          { x: 40, y: 55 },
          { x: 60, y: 55 },
          { x: 60, y: 72 },
          { x: 40, y: 72 },
          { x: 41, y: 56 },
        ],
      },
      {
        id: "hedge",
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 22 + i * 0.2,
          y: 25 + i * 4,
        })),
      },
    ];
    const g = interpretSketchStrokesToCad(strokes, { boundary, building });
    expect(g).toHaveLength(2);
    const ids = g.map((s) => s.symbol_id).sort();
    expect(ids).toEqual(["deck", "hedge"]);
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

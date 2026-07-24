import { describe, expect, it } from "vitest";
import {
  applyCanvasMetresFit,
  canvasMetresFit,
  canvasMetresRingToPct,
  easementRingsToPct,
} from "./geoToPct";

const squareLot = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 },
];

describe("canvasMetresFit / canvasMetresRingToPct", () => {
  it("fits a square lot centred with default padding", () => {
    const pct = canvasMetresRingToPct(squareLot);
    expect(pct).toHaveLength(4);
    const xs = pct.map((p) => p.x);
    const ys = pct.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(8);
    expect(Math.max(...xs)).toBeCloseTo(92);
    expect(Math.min(...ys)).toBeCloseTo(8);
    expect(Math.max(...ys)).toBeCloseTo(92);
  });

  it("flips Y — north-up metres render board-down", () => {
    const fit = canvasMetresFit(squareLot)!;
    const north = applyCanvasMetresFit(fit, { x: 0, y: 20 });
    const south = applyCanvasMetresFit(fit, { x: 0, y: 0 });
    expect(north.y).toBeLessThan(south.y);
  });

  it("returns empty for fewer than 3 vertices", () => {
    expect(canvasMetresRingToPct([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
  });
});

describe("easementRingsToPct", () => {
  it("projects a centreline through the boundary's own fit transform", () => {
    // Easement runs along the lot's north edge (y=19), full width.
    const rings = easementRingsToPct(squareLot, [
      {
        points: [
          { x: 0, y: 19 },
          { x: 20, y: 19 },
        ],
      },
    ]);
    expect(rings).toHaveLength(1);
    const ring = rings[0]!;
    expect(ring).toHaveLength(4);
    // Boundary fit: 20 m → 84 pct (scale 4.2). Centreline at y=19 m →
    // pct y = 8 + (20 − 19) × 4.2 = 12.2; ±0.9 m → ±3.78 pct.
    const ys = ring.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(12.2 - 0.9 * 4.2, 5);
    expect(Math.max(...ys)).toBeCloseTo(12.2 + 0.9 * 4.2, 5);
  });

  it("clips block-long centrelines to the lot frame without distortion", () => {
    // Vertical easement line running the whole street block at x=10 m.
    const rings = easementRingsToPct(squareLot, [
      {
        points: [
          { x: 10, y: -50 },
          { x: 10, y: 80 },
        ],
      },
    ]);
    expect(rings).toHaveLength(1);
    const ring = rings[0]!;
    // Corridor stays a vertical band around x = 50 pct (10 m × scale 4.2 + 8),
    // ±0.9 m × 4.2 — no corner is dragged sideways by clamping.
    for (const p of ring) {
      expect(p.x).toBeGreaterThanOrEqual(50 - 0.9 * 4.2 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(50 + 0.9 * 4.2 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty without a valid boundary or easements", () => {
    expect(easementRingsToPct([], [{ points: squareLot }])).toEqual([]);
    expect(easementRingsToPct(squareLot, [])).toEqual([]);
    expect(
      easementRingsToPct(squareLot, [{ points: [{ x: 5, y: 5 }] }]),
    ).toEqual([]);
  });
});

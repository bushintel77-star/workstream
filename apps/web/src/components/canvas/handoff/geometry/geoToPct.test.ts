import { describe, expect, it } from "vitest";
import {
  applyCanvasMetresTransform,
  canvasMetresRingToPct,
  fitCanvasMetresRing,
} from "./geoToPct";
import { edgeLengthM, polygonAreaM2 } from "./polygon";

describe("fitCanvasMetresRing", () => {
  const parcel30x20 = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 20 },
    { x: 0, y: 20 },
  ];

  it("reports the board scale implied by the letterbox fit", () => {
    const fit = fitCanvasMetresRing(parcel30x20);
    // pad 8 → 84% available for 30 m → 2.8 %/m → 100% board ≈ 35.714 m
    expect(fit.boardWidthM).toBeCloseTo(100 / (84 / 30), 6);
  });

  it("round-trips real metres through % space with the implied scale", () => {
    const fit = fitCanvasMetresRing(parcel30x20);
    const scaleM = fit.boardWidthM!;
    // Area of the 30×20 m parcel must survive metres → % → metres.
    expect(polygonAreaM2(fit.points, scaleM)).toBeCloseTo(600, 6);
    // The 30 m edge must read 30 m again.
    expect(
      edgeLengthM(fit.points[0]!, fit.points[1]!, scaleM),
    ).toBeCloseTo(30, 6);
  });

  it("returns null scale for degenerate rings", () => {
    expect(fitCanvasMetresRing([{ x: 0, y: 0 }])).toEqual({
      points: [],
      boardWidthM: null,
      transform: null,
    });
  });

  it("keeps the points-only wrapper behaviour", () => {
    const pct = canvasMetresRingToPct(parcel30x20);
    expect(pct).toEqual(fitCanvasMetresRing(parcel30x20).points);
    expect(Math.min(...pct.map((p) => p.x))).toBeGreaterThanOrEqual(7);
    expect(Math.max(...pct.map((p) => p.x))).toBeLessThanOrEqual(93);
  });

  it("co-registers a house ring with the title transform", () => {
    const fit = fitCanvasMetresRing(parcel30x20);
    expect(fit.transform).toBeTruthy();
    // 10×10 m house inset 5 m from the SW corner of the 30×20 parcel.
    const house = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ];
    const housePct = applyCanvasMetresTransform(house, fit.transform!);
    // House must sit inside the fitted parcel bbox.
    const xs = fit.points.map((p) => p.x);
    const ys = fit.points.map((p) => p.y);
    expect(Math.min(...housePct.map((p) => p.x))).toBeGreaterThan(
      Math.min(...xs),
    );
    expect(Math.max(...housePct.map((p) => p.x))).toBeLessThan(Math.max(...xs));
    expect(Math.min(...housePct.map((p) => p.y))).toBeGreaterThan(
      Math.min(...ys),
    );
    expect(Math.max(...housePct.map((p) => p.y))).toBeLessThan(Math.max(...ys));
  });
});

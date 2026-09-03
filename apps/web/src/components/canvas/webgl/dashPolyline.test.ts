import { describe, expect, it } from "vitest";
import {
  dashPolyline,
  dashRunsToSegments,
  drawnLength,
  polylineLength,
  type Vec3,
} from "./dashPolyline";
import { MATERIALS, dashSignatureMetres, materialById } from "./materials";

/** A straight run along +X, `len` long. */
const straight = (len: number): Vec3[] => [
  [0, 0, 0],
  [len, 0, 0],
];

describe("dashPolyline — Phase M.3/M.4", () => {
  it("returns nothing for a degenerate line", () => {
    expect(dashPolyline([], [1, 1])).toEqual([]);
    expect(dashPolyline([[0, 0, 0]], [1, 1])).toEqual([]);
  });

  it("an empty pattern is a solid line", () => {
    const pts = straight(10);
    const runs = dashPolyline(pts, []);
    expect(runs).toHaveLength(1);
    expect(drawnLength(runs)).toBeCloseTo(10, 6);
  });

  it("a pattern of zeros cannot hang, and draws solid", () => {
    const runs = dashPolyline(straight(10), [0, 0]);
    expect(drawnLength(runs)).toBeCloseTo(10, 6);
  });

  it("splits a straight line into the pattern's runs", () => {
    // 2 on / 2 off over 10m -> on at [0,2], [4,6], [8,10]
    const runs = dashPolyline(straight(10), [2, 2]);
    expect(runs).toHaveLength(3);
    expect(runs[0]![0]![0]).toBeCloseTo(0, 6);
    expect(runs[0]![1]![0]).toBeCloseTo(2, 6);
    expect(runs[1]![0]![0]).toBeCloseTo(4, 6);
    expect(runs[1]![1]![0]).toBeCloseTo(6, 6);
    expect(runs[2]![0]![0]).toBeCloseTo(8, 6);
  });

  it("holds the duty cycle the pattern asks for", () => {
    const runs = dashPolyline(straight(100), [3, 1]);
    // 75% on, within one pattern period of the end.
    expect(drawnLength(runs) / 100).toBeGreaterThan(0.7);
    expect(drawnLength(runs) / 100).toBeLessThan(0.8);
  });

  it("never draws more than the line itself", () => {
    for (const pattern of [[2, 2], [18, 7, 3, 7], [0.5, 0.5], [26, 10]]) {
      const runs = dashPolyline(straight(40), pattern);
      expect(drawnLength(runs)).toBeLessThanOrEqual(40 + 1e-6);
    }
  });

  it("carries the pattern across corners by arc length, not per segment", () => {
    // An L: 5m east then 5m north. A 2/2 pattern must not restart at the
    // corner — the signature is continuous along the run.
    const l: Vec3[] = [
      [0, 0, 0],
      [5, 0, 0],
      [5, 0, 5],
    ];
    const runs = dashPolyline(l, [2, 2]);
    expect(drawnLength(runs)).toBeCloseTo(drawnLength(dashPolyline(straight(10), [2, 2])), 6);
  });

  it("keeps a dash-dot pattern distinct from an even dash", () => {
    // Same nominal dash, different signature: the dash-dot draws a short
    // tick between the long strokes, so less of the line is inked.
    const dashDot = dashPolyline(straight(60), [18, 7, 3, 7]);
    const even = dashPolyline(straight(60), [18, 7]);
    expect(drawnLength(dashDot)).not.toBeCloseTo(drawnLength(even), 3);
    expect(drawnLength(dashDot)).toBeLessThan(drawnLength(even));
    // And the runs themselves are different lengths, not just fewer.
    const lengths = (runs: Vec3[][]) =>
      runs.map((r) => Number((r[r.length - 1]![0] - r[0]![0]).toFixed(3)));
    expect(lengths(dashDot)).not.toEqual(lengths(even));
  });

  it("skips zero-length segments without emitting empty runs", () => {
    const withDupes: Vec3[] = [
      [0, 0, 0],
      [0, 0, 0],
      [10, 0, 0],
    ];
    const runs = dashPolyline(withDupes, [2, 2]);
    for (const run of runs) expect(run.length).toBeGreaterThanOrEqual(2);
  });

  it("polylineLength measures the full run", () => {
    expect(polylineLength(straight(7))).toBeCloseTo(7, 6);
  });

  describe("dashRunsToSegments", () => {
    it("emits point pairs", () => {
      const segs = dashRunsToSegments(dashPolyline(straight(10), [2, 2]));
      expect(segs.length % 2).toBe(0);
      expect(segs.length).toBe(6); // 3 runs x 1 segment x 2 points
    });

    it("is empty for a line with no drawn runs", () => {
      expect(dashRunsToSegments([])).toEqual([]);
    });
  });

  describe("M.4 — the signature is constant in world space", () => {
    it("dash lengths do not depend on the camera, only the sheet scale", () => {
      const setback = materialById("setback")!;
      const at200 = dashSignatureMetres(setback, 200);
      const at100 = dashSignatureMetres(setback, 100);
      expect(at200[0]).toBeGreaterThan(0);
      // Half the scale denominator, half the ground length.
      expect(at100[0]).toBeCloseTo(at200[0]! / 2, 6);
    });

    it("the same line dashes identically however far the camera is", () => {
      // Zoom is not an input to any of this — the proof is that the same
      // world polyline and pattern give the same runs every time.
      const pattern = dashSignatureMetres(materialById("survey")!, 200);
      const a = dashPolyline(straight(50), pattern);
      const b = dashPolyline(straight(50), pattern);
      expect(drawnLength(a)).toBeCloseTo(drawnLength(b), 9);
      expect(a.length).toBe(b.length);
    });
  });

  describe("M.3 — every semantic markup material has a usable signature", () => {
    it("produces a dashed line for each semantic material", () => {
      const semantic = MATERIALS.filter((m) => m.semantic);
      expect(semantic.length).toBeGreaterThan(0);
      for (const m of semantic) {
        const pattern = dashSignatureMetres(m, 200);
        expect(pattern.length, `${m.id} has no dash signature`).toBeGreaterThan(0);
        const runs = dashPolyline(straight(80), pattern);
        expect(runs.length, `${m.id} renders solid`).toBeGreaterThan(1);
      }
    });

    it("no two semantic materials share a signature", () => {
      const seen = new Map<string, string>();
      for (const m of MATERIALS.filter((x) => x.semantic)) {
        const key = dashSignatureMetres(m, 200)
          .map((n) => n.toFixed(4))
          .join("/");
        expect(seen.has(key), `${m.id} and ${seen.get(key)} dash the same`).toBe(
          false,
        );
        seen.set(key, m.id);
      }
    });
  });
});

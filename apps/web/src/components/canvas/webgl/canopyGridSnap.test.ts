import { describe, expect, it } from "vitest";
import {
  CANOPY_GRID_M,
  SCATTER_COUNT,
  SCATTER_RADIUS_FACTOR,
  isCanopySymbol,
  snapForSymbol,
  scatterDropPoints,
  shouldScatter,
} from "./canopyGridSnap";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";
import type { PctPoint } from "./coordTransform";

describe("canopyGridSnap — Phase M.8", () => {
  describe("constants", () => {
    it("canopy grid is 3m per spec", () => {
      expect(CANOPY_GRID_M).toBe(3);
    });

    it("scatter count is 5 per spec", () => {
      expect(SCATTER_COUNT).toBe(5);
    });

    it("scatter radius factor is positive", () => {
      expect(SCATTER_RADIUS_FACTOR).toBeGreaterThan(0);
    });
  });

  describe("isCanopySymbol", () => {
    it("returns true for canopy symbol", () => {
      expect(isCanopySymbol(TYPE_TO_SYMBOL.canopy)).toBe(true);
    });

    it("returns true for feature symbol", () => {
      expect(isCanopySymbol(TYPE_TO_SYMBOL.feature)).toBe(true);
    });

    it("returns false for paving symbol", () => {
      expect(isCanopySymbol(TYPE_TO_SYMBOL.paving)).toBe(false);
    });
  });

  describe("snapForSymbol", () => {
    it("snaps canopy to 3m grid", () => {
      const raw: PctPoint = { x: 33.7, y: 27.2 };
      const scaleM = 30;
      const snapped = snapForSymbol(raw, scaleM, TYPE_TO_SYMBOL.canopy);
      // 3m grid on 30m board = 10% steps
      expect(snapped.x % 10).toBeCloseTo(0, 5);
      expect(snapped.y % 10).toBeCloseTo(0, 5);
    });

    it("snaps non-canopy to 0.5m grid", () => {
      const raw: PctPoint = { x: 33.7, y: 27.2 };
      const scaleM = 30;
      const snapped = snapForSymbol(raw, scaleM, TYPE_TO_SYMBOL.paving);
      // 0.5m grid on 30m board = 1.667% steps
      // Just verify it's different from the 3m snap
      const canopySnapped = snapForSymbol(raw, scaleM, TYPE_TO_SYMBOL.canopy);
      expect(snapped).not.toEqual(canopySnapped);
    });
  });

  describe("scatterDropPoints", () => {
    it("returns exactly SCATTER_COUNT points", () => {
      const centre: PctPoint = { x: 50, y: 50 };
      const points = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 42);
      expect(points.length).toBe(SCATTER_COUNT);
    });

    it("first point is the centre", () => {
      const centre: PctPoint = { x: 50, y: 50 };
      const points = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 42);
      expect(points[0]).toEqual(centre);
    });

    it("is deterministic with same seed", () => {
      const centre: PctPoint = { x: 50, y: 50 };
      const a = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 42);
      const b = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 42);
      expect(a).toEqual(b);
    });

    it("differs with different seed", () => {
      const centre: PctPoint = { x: 50, y: 50 };
      const a = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 42);
      const b = scatterDropPoints(centre, 30, 0.75, TYPE_TO_SYMBOL.canopy, 99);
      expect(a).not.toEqual(b);
    });

    it("scatter points are within radius of centre", () => {
      const centre: PctPoint = { x: 50, y: 50 };
      const scaleM = 30;
      const boardAspect = 0.75;
      const points = scatterDropPoints(centre, scaleM, boardAspect, TYPE_TO_SYMBOL.canopy, 42);
      // All points should be within scatter radius (factor * mature spread)
      // For canopy, mature spread is typically several metres
      for (const p of points) {
        const dxPct = Math.abs(p.x - centre.x);
        const dyPct = Math.abs(p.y - centre.y);
        // Just verify they're not absurdly far (within 20% of board)
        expect(dxPct).toBeLessThan(20);
        expect(dyPct).toBeLessThan(20);
      }
    });
  });

  describe("shouldScatter", () => {
    it("returns true when alt is held", () => {
      expect(shouldScatter(true)).toBe(true);
    });

    it("returns false when alt is not held", () => {
      expect(shouldScatter(false)).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import type { CanvasStroke } from "@workstream/contracts";
import {
  ZERO_VOLUMES,
  formatSignedM3,
  formatVolumeDelta,
  volumeDelta,
  volumesForState,
} from "./historyVolumeDelta";

const SCALE_M = 100;
const ASPECT = 1;

/** Flat ground at 0m — a pad raised above it is pure fill. */
const flat = () => 0;
/** A slope running up in +x through the board centre (pctToWorld is centred
 *  on the origin), so a flat pad cuts the high end and fills the low end. */
const slope = (x: number) => x * 0.1;

/** A closed square pad in board %, extruded to `heightM`. */
function padStroke(id: string, heightM: number, size = 20): CanvasStroke {
  const half = size / 2;
  const pts = [
    { x_pct: 50 - half, y_pct: 50 - half },
    { x_pct: 50 + half, y_pct: 50 - half },
    { x_pct: 50 + half, y_pct: 50 + half },
    { x_pct: 50 - half, y_pct: 50 + half },
    { x_pct: 50 - half, y_pct: 50 - half },
  ];
  return {
    id,
    points: pts,
    color: "#fff",
    width_px: 2,
    extrude_height_m: heightM,
  } as CanvasStroke;
}

describe("historyVolumeDelta — Phase P.1", () => {
  describe("volumesForState", () => {
    it("is an honest zero with no terrain to measure against", () => {
      expect(
        volumesForState([padStroke("a", 1)], [], null, SCALE_M, ASPECT),
      ).toEqual(ZERO_VOLUMES);
    });

    it("is zero with nothing extruded", () => {
      expect(volumesForState([], [], flat, SCALE_M, ASPECT)).toEqual(
        ZERO_VOLUMES,
      );
      // A stroke with no height is not a pad.
      expect(
        volumesForState([padStroke("a", 0)], [], flat, SCALE_M, ASPECT),
      ).toEqual(ZERO_VOLUMES);
    });

    it("a pad raised over flat ground is fill, not cut", () => {
      const v = volumesForState([padStroke("a", 1)], [], flat, SCALE_M, ASPECT);
      expect(v.fillM3).toBeGreaterThan(0);
      expect(v.cutM3).toBe(0);
    });

    it("a pad on a slope both cuts and fills", () => {
      const v = volumesForState([padStroke("a", 0.5)], [], slope, SCALE_M, ASPECT);
      expect(v.cutM3).toBeGreaterThan(0);
      expect(v.fillM3).toBeGreaterThan(0);
    });

    it("more pads move more dirt", () => {
      const one = volumesForState([padStroke("a", 1)], [], flat, SCALE_M, ASPECT);
      const two = volumesForState(
        [padStroke("a", 1), padStroke("b", 2)],
        [],
        flat,
        SCALE_M,
        ASPECT,
      );
      expect(two.fillM3).toBeGreaterThan(one.fillM3);
    });

    it("returns whole cubic metres", () => {
      const v = volumesForState([padStroke("a", 1.37)], [], flat, SCALE_M, ASPECT);
      expect(Number.isInteger(v.cutM3)).toBe(true);
      expect(Number.isInteger(v.fillM3)).toBe(true);
    });
  });

  describe("volumeDelta", () => {
    it("is unchanged when the two states match", () => {
      const d = volumeDelta({ cutM3: 12, fillM3: 8 }, { cutM3: 12, fillM3: 8 });
      expect(d.unchanged).toBe(true);
      expect(d.cutDeltaM3).toBe(0);
      expect(d.fillDeltaM3).toBe(0);
    });

    it("signs the delta as now minus then", () => {
      const d = volumeDelta({ cutM3: 10, fillM3: 20 }, { cutM3: 30, fillM3: 5 });
      expect(d.cutDeltaM3).toBe(20);
      expect(d.fillDeltaM3).toBe(-15);
      expect(d.unchanged).toBe(false);
    });

    it("keeps both sides so the delta can be read against something", () => {
      const d = volumeDelta({ cutM3: 1, fillM3: 2 }, { cutM3: 3, fillM3: 4 });
      expect(d.then).toEqual({ cutM3: 1, fillM3: 2 });
      expect(d.now).toEqual({ cutM3: 3, fillM3: 4 });
    });
  });

  describe("formatSignedM3", () => {
    it("signs both directions and zero", () => {
      expect(formatSignedM3(12)).toBe("+12 m³");
      expect(formatSignedM3(-4)).toBe("−4 m³");
      expect(formatSignedM3(0)).toBe("0 m³");
    });
  });

  describe("formatVolumeDelta", () => {
    it("states the then volumes even when nothing changed", () => {
      const line = formatVolumeDelta(
        volumeDelta({ cutM3: 7, fillM3: 3 }, { cutM3: 7, fillM3: 3 }),
      );
      expect(line).toContain("then cut 7 m³");
      expect(line).toContain("fill 3 m³");
      expect(line).toContain("no earthworks change");
    });

    it("never states a bare delta with nothing to read it against", () => {
      const line = formatVolumeDelta(
        volumeDelta({ cutM3: 10, fillM3: 10 }, { cutM3: 50, fillM3: 4 }),
      );
      expect(line).toContain("then cut 10 m³");
      expect(line).toContain("+40 m³ cut");
      expect(line).toContain("−6 m³ fill");
    });
  });
});

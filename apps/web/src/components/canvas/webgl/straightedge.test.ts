import { describe, expect, it } from "vitest";
import {
  formatRulerMetres,
  projectOntoStraightedge,
  straightedgeLengthM,
  STRAIGHTEDGE_MIN_LENGTH_M,
  STRAIGHTEDGE_PROXIMITY_PCT,
  type Straightedge,
} from "./straightedge";

/**
 * Straightedge — the Trace ruler rail tool (gap-analysis Phase 1). Pure
 * geometry: capture-by-proximity, clamp-to-segment, world-metre truth.
 *
 * Board convention: scaleM = metres per 100 board-%, aspect 1 by law, so a
 * 110 m board makes 1% = 1.1 m and the board centre sits at (55, 55)%.
 */

const SCALE = 110;
const ASPECT = 1;

/** Board-% → world metres (mirrors coordTransform.pctToWorld). */
const w = (pct: { x: number; y: number }) => {
  return { x: (pct.x / 100) * SCALE - SCALE / 2, z: (pct.y / 100) * SCALE - SCALE / 2 };
};

/** A 20 m east–west ruler centred on the board: 40%→60% at y=50%. */
const EDGE: Straightedge = {
  a: { x: 40, y: 50 },
  b: { x: 60, y: 50 },
};

describe("straightedge geometry", () => {
  it("measures the edge in world metres", () => {
    expect(straightedgeLengthM(EDGE, SCALE, ASPECT)).toBeCloseTo(22, 6);
  });

  it("projects a near point exactly onto the edge, metres from end a", () => {
    // 1% (1.1 m — inside the 1.65 m band) north of the edge, 5.5 m (5%)
    // along from a.
    const raw = w({ x: 45, y: 49 });
    const hit = projectOntoStraightedge(raw, EDGE, SCALE, ASPECT);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(w({ x: 45, y: 50 }).x, 6);
    expect(hit!.z).toBeCloseTo(w({ x: 45, y: 50 }).z, 6);
    expect(hit!.alongM).toBeCloseTo(5.5, 6);
    expect(hit!.edgeLengthM).toBeCloseTo(22, 6);
    expect(hit!.offM).toBeCloseTo(1.1, 6);
  });

  it("clamps capture to the ruler's extent — just past the end sticks to the tip", () => {
    // 1% past end b, dead on the line's axis: within the tip's proximity
    // band, so the capture lands ON the tip, not beyond it.
    const raw = w({ x: 61, y: 50 });
    const hit = projectOntoStraightedge(raw, EDGE, SCALE, ASPECT);
    expect(hit).not.toBeNull();
    expect(hit!.alongM).toBeCloseTo(22, 6); // = edgeLengthM (the b tip)
    // Far past the end the band no longer reaches — the stroke stays free.
    expect(projectOntoStraightedge(w({ x: 70, y: 50 }), EDGE, SCALE, ASPECT)).toBeNull();
  });

  it("stays freehand beyond the proximity band (assist, never constrain)", () => {
    // 5% (5.5 m) off the edge — past the 1.65 m band at this scale.
    const raw = w({ x: 45, y: 45 });
    expect(projectOntoStraightedge(raw, EDGE, SCALE, ASPECT)).toBeNull();
  });

  it("the proximity band is 1.5% of the board scale", () => {
    expect((SCALE * STRAIGHTEDGE_PROXIMITY_PCT) / 100).toBeCloseTo(1.65, 6);
    // Just inside the band (1.5 m off) still captures.
    const raw = w({ x: 45, y: 50 - 1.5 / SCALE * 100 });
    expect(projectOntoStraightedge(raw, EDGE, SCALE, ASPECT)).not.toBeNull();
  });

  it("a custom proximity tightens the band", () => {
    const raw = w({ x: 45, y: 49 }); // 1.1 m off
    expect(
      projectOntoStraightedge(raw, EDGE, SCALE, ASPECT, { proximityM: 1 }),
    ).toBeNull();
    expect(
      projectOntoStraightedge(raw, EDGE, SCALE, ASPECT, { proximityM: 2 }),
    ).not.toBeNull();
  });

  it("a degenerate zero-length edge never captures", () => {
    const raw = w({ x: 50, y: 50 });
    expect(
      projectOntoStraightedge(raw, { a: { x: 50, y: 50 }, b: { x: 50, y: 50 } }, SCALE, ASPECT),
    ).toBeNull();
  });

  it("the minimum placement length is a physical floor", () => {
    expect(STRAIGHTEDGE_MIN_LENGTH_M).toBeGreaterThan(0);
  });

  it("formats ruler metres with one decimal (calibrated feel)", () => {
    expect(formatRulerMetres(12.44)).toBe("12.4");
    expect(formatRulerMetres(0.8)).toBe("0.8");
  });
});

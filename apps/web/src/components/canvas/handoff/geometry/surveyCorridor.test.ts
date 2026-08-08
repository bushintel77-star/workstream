import { describe, expect, it } from "vitest";
import {
  classifySurveyCorridor,
  closeSurveyRing,
  nearSurveyRingStart,
} from "./surveyCorridor";

describe("surveyCorridor", () => {
  it("routes two-point traces to services", () => {
    const r = classifySurveyCorridor([
      { x: 10, y: 10 },
      { x: 40, y: 12 },
    ]);
    expect(r?.kind).toBe("service");
    expect(r?.ring).toHaveLength(2);
  });

  it("routes closed polygons to easements and closes the ring", () => {
    const r = classifySurveyCorridor([
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ]);
    expect(r?.kind).toBe("easement");
    expect(r?.ring.length).toBe(5);
    expect(r?.ring[0]).toEqual(r?.ring[r.ring.length - 1]);
  });

  it("closeSurveyRing does not duplicate an already-closed vertex", () => {
    const closed = closeSurveyRing([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0.2, y: 0.1 },
    ]);
    expect(closed).toHaveLength(4);
    expect(closed[closed.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it("detects click-near-start for easement close", () => {
    const ring = [
      { x: 20, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 50 },
    ];
    expect(nearSurveyRingStart(ring, { x: 20.5, y: 20.2 })).toBe(true);
    expect(nearSurveyRingStart(ring, { x: 40, y: 40 })).toBe(false);
  });
});

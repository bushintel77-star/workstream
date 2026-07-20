import { describe, expect, it } from "vitest";
import {
  NEUTRAL_DRAINAGE_SCORE,
  computeLiveConfidenceFactors,
  emptyLiveGhostScene,
  sunShadowVector,
  type LiveGhostScene,
  type LiveGhostSubject,
} from "./ghost-confidence";

const canopyGhost = (over: Partial<LiveGhostSubject> = {}): LiveGhostSubject => ({
  typeId: "canopy",
  x: 30,
  y: 70,
  scale: 1,
  rate: 650,
  canopyM: 6,
  heightM: 6,
  peerRates: [650, 1200, 180],
  seedConf: 0.8,
  ...over,
});

describe("sunShadowVector", () => {
  it("changes direction between morning and afternoon", () => {
    const am = sunShadowVector(8 * 60);
    const pm = sunShadowVector(16 * 60);
    expect(am.dx).not.toBeCloseTo(pm.dx, 2);
  });
});

describe("computeLiveConfidenceFactors", () => {
  it("uses neutral drainage for hardscape until services exist", () => {
    const scene = emptyLiveGhostScene();
    const r = computeLiveConfidenceFactors(
      {
        typeId: "paving",
        x: 50,
        y: 50,
        rate: 320,
        peerRates: [45, 320, 480],
      },
      scene,
    );
    const drain = r.factors.find((f) => f.label === "Drainage intercept");
    expect(drain?.pct).toBe(NEUTRAL_DRAINAGE_SCORE);
  });

  it("lowers root clearance when a ghost sits inside a TPZ", () => {
    const scene: LiveGhostScene = {
      ...emptyLiveGhostScene(),
      trees: [
        {
          x: 50,
          y: 50,
          tpzRadiusPct: 8,
          canopyM: 6,
          heightM: 8,
          scale: 1,
          existing: true,
        },
      ],
    };
    const outside = computeLiveConfidenceFactors(
      canopyGhost({ x: 70, y: 50 }),
      scene,
    );
    const inside = computeLiveConfidenceFactors(
      canopyGhost({ x: 52, y: 50 }),
      scene,
    );
    const rootOut = outside.factors.find((f) => f.label === "Root clearance")!;
    const rootIn = inside.factors.find((f) => f.label === "Root clearance")!;
    expect(rootIn.pct).toBeLessThan(rootOut.pct);
    expect(inside.notes.some((n) => /root zone/i.test(n))).toBe(true);
  });

  it("changes canopy sun score when the shadow vector flips", () => {
    const base = emptyLiveGhostScene();
    const morning: LiveGhostScene = {
      ...base,
      shadow: sunShadowVector(8 * 60),
      buildingCentroid: { x: 50, y: 50 },
    };
    const afternoon: LiveGhostScene = {
      ...base,
      shadow: sunShadowVector(16 * 60),
      buildingCentroid: { x: 50, y: 50 },
    };
    // West-side canopy
    const g = canopyGhost({ x: 25, y: 50 });
    const am = computeLiveConfidenceFactors(g, morning);
    const pm = computeLiveConfidenceFactors(g, afternoon);
    const sunAm = am.factors.find((f) => f.label === "Sun exposure")!.pct;
    const sunPm = pm.factors.find((f) => f.label === "Sun exposure")!.pct;
    expect(sunAm).not.toBe(sunPm);
  });

  it("scores cheaper materials higher on cost efficiency", () => {
    const scene = emptyLiveGhostScene();
    const cheap = computeLiveConfidenceFactors(
      {
        typeId: "lawn",
        x: 40,
        y: 40,
        rate: 45,
        peerRates: [45, 320, 480],
      },
      scene,
    );
    const dear = computeLiveConfidenceFactors(
      {
        typeId: "deck",
        x: 40,
        y: 40,
        rate: 480,
        peerRates: [45, 320, 480],
      },
      scene,
    );
    const c = cheap.factors.find((f) => f.label === "Cost efficiency")!.pct;
    const d = dear.factors.find((f) => f.label === "Cost efficiency")!.pct;
    expect(c).toBeGreaterThan(d);
  });
});

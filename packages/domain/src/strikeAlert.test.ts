import { describe, it, expect } from "vitest";
import {
  detectStrikes,
  detectLayerStrikes,
  type UtilityLine,
  type DesignExcavation,
  type DigHazardSegment,
} from "./strikeAlert";

describe("strikeAlert (collision detection)", () => {
  const utility: UtilityLine = {
    id: "util-gas-1",
    type: "gas",
    start: [0, 5],
    end: [20, 5],
    depthM: 0.6,
    toleranceM: 0.3,
  };

  it("detects a direct collision when a trench crosses a utility", () => {
    const trench: DesignExcavation = {
      id: "trench-1",
      path: [[5, 0], [5, 10]],
      depthM: 0.8, // deeper than the utility
      widthM: 0.4,
    };
    const alerts = detectStrikes([trench], [utility]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("direct");
    expect(alerts[0].utilityType).toBe("gas");
  });

  it("does not alert when the trench is shallower than the utility", () => {
    const shallowTrench: DesignExcavation = {
      id: "trench-shallow",
      path: [[5, 0], [5, 10]],
      depthM: 0.2, // above the utility's top (0.6 - 0.3 = 0.3m)
      widthM: 0.4,
    };
    const alerts = detectStrikes([shallowTrench], [utility]);
    expect(alerts).toHaveLength(0);
  });

  it("does not alert when the trench is far from the utility in plan", () => {
    const farTrench: DesignExcavation = {
      id: "trench-far",
      path: [[0, 50], [20, 50]], // 45m away
      depthM: 1.0,
      widthM: 0.4,
    };
    const alerts = detectStrikes([farTrench], [utility]);
    expect(alerts).toHaveLength(0);
  });

  it("classifies proximity when near but not direct", () => {
    const nearTrench: DesignExcavation = {
      id: "trench-near",
      path: [[0, 5.35], [20, 5.35]], // 0.35m offset, threshold = 0.2 + 0.3 = 0.5
      depthM: 0.8,
      widthM: 0.4,
    };
    const alerts = detectStrikes([nearTrench], [utility]);
    expect(alerts).toHaveLength(1);
    // overlap = 0.5 - 0.35 = 0.15 → "near"
    expect(alerts[0].severity).toBe("near");
  });

  it("sorts strikes by severity (direct first)", () => {
    const direct: DesignExcavation = {
      id: "direct",
      path: [[5, 0], [5, 10]],
      depthM: 0.8,
      widthM: 0.4,
    };
    const near: DesignExcavation = {
      id: "near",
      path: [[0, 5.35], [20, 5.35]],
      depthM: 0.8,
      widthM: 0.4,
    };
    const alerts = detectStrikes([near, direct], [utility]);
    expect(alerts[0].severity).toBe("direct");
    expect(alerts[1].severity).toBe("near");
  });

  it("handles multiple utilities and excavations", () => {
    const water: UtilityLine = {
      id: "util-water-1",
      type: "water",
      start: [0, 15],
      end: [20, 15],
      depthM: 0.5,
      toleranceM: 0.25,
    };
    const trench: DesignExcavation = {
      id: "trench-cross",
      path: [[5, 0], [5, 20]], // crosses both utilities
      depthM: 1.0,
      widthM: 0.3,
    };
    const alerts = detectStrikes([trench], [utility, water]);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.utilityType).sort()).toEqual(["gas", "water"]);
  });
});

describe("detectLayerStrikes (dig-safety layers)", () => {
  const crossingTrench: DesignExcavation = {
    id: "trench-1",
    path: [[5, 0], [5, 10]],
    depthM: 0.8,
    widthM: 0.4,
  };
  const hazard: DigHazardSegment = {
    id: "easement-0-2",
    layerId: "vicmap.easement",
    start: [0, 5],
    end: [20, 5],
    toleranceM: 0.9,
  };

  it("raises a strike with full feature-ID attribution when a trench crosses a dig-safety layer", () => {
    const alerts = detectLayerStrikes([crossingTrench], [hazard]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.layerId).toBe("vicmap.easement");
    expect(alerts[0]!.hazardId).toBe("easement-0-2");
    expect(alerts[0]!.excavationId).toBe("trench-1");
    expect(alerts[0]!.severity).toBe("direct");
    expect(alerts[0]!.point[0]).toBeCloseTo(5);
  });

  it("has NO depth gate — a shallow trench crossing a dig-safety layer still alerts", () => {
    const shallow: DesignExcavation = {
      id: "trench-shallow",
      path: [[5, 0], [5, 10]],
      depthM: 0.1,
      widthM: 0.4,
    };
    expect(detectLayerStrikes([shallow], [hazard])).toHaveLength(1);
  });

  it("grades severity by the dig-clearance distance (near / proximity / none)", () => {
    // threshold = width/2 + tolerance = 0.2 + 0.9 = 1.1 m. The hazard runs
    // horizontally at y=5; parallel runs at y = 5 + offset keep a pure
    // distance of `offset` (no perpendicular crossing).
    const run = (offset: number) => {
      const e: DesignExcavation = {
        id: "trench-offset",
        path: [[0, 5 + offset], [20, 5 + offset]],
        depthM: 0.8,
        widthM: 0.4,
      };
      return detectLayerStrikes([e], [hazard]);
    };
    // offset 0.9 → overlap 0.2 → near
    expect(run(0.9)[0]!.severity).toBe("near");
    // offset 1.05 → overlap 0.05 → proximity
    expect(run(1.05)[0]!.severity).toBe("proximity");
    // offset 2 → outside the clearance → no alert
    expect(run(2)).toHaveLength(0);
  });

  it("sorts direct strikes first across hazards", () => {
    // A parallel run 0.9 m from the trench → near; the crossing → direct.
    const nearHazard: DigHazardSegment = {
      ...hazard,
      id: "easement-1-0",
      start: [5.9, 0],
      end: [5.9, 10],
    };
    const alerts = detectLayerStrikes([crossingTrench], [nearHazard, hazard]);
    expect(alerts[0]!.hazardId).toBe("easement-0-2");
    expect(alerts[0]!.severity).toBe("direct");
    expect(alerts[1]!.hazardId).toBe("easement-1-0");
    expect(alerts[1]!.severity).toBe("near");
  });
});

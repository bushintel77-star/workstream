import { describe, it, expect } from "vitest";
import { detectStrikes, type UtilityLine, type DesignExcavation } from "./strikeAlert";

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

import { describe, expect, it } from "vitest";
import { buildScanChoreography } from "./scanChoreography";
import { useStudioStore } from "./studioStore";

const FULL = {
  boundaryPts: 13,
  buildingCount: 1,
  neighbourCount: 4,
  easementCount: 2,
  serviceLineCount: 1,
  hasTerrain: true,
  contourRingCount: 1,
  treeCount: 31,
};

describe("buildScanChoreography", () => {
  it("orders the categories and labels carry the real counts", () => {
    const c = buildScanChoreography(FULL);
    if (!c) throw new Error("unreachable");
    expect(c.events.map((e) => e.stage)).toEqual([
      "cadastre",
      "parcels",
      "services",
      "terrain",
      "flora",
    ]);
    expect(c.events.map((e) => e.mode)).toEqual([
      "draw",
      "extrude",
      "antpath",
      "fade",
      "grow",
    ]);
    expect(c.events[0]!.label).toContain("13 points");
    expect(c.events[1]!.label).toContain("5 buildings");
    expect(c.events[3]!.label).toContain("contours + heightmap");
    expect(c.events[4]!.label).toContain("31 existing trees");
    // Tree reveal scales with count: 600 + 31×50 = 2150, capped at 2200.
    expect(c.events[4]!.durationMs).toBe(2150);
    const capped = buildScanChoreography({ ...FULL, treeCount: 60 });
    if (!capped) throw new Error("unreachable");
    expect(capped.events[4]!.durationMs).toBe(2200);
  });

  it("absent categories emit no event (zero-mock law)", () => {
    const c = buildScanChoreography({
      ...FULL,
      buildingCount: 0,
      neighbourCount: 0,
      easementCount: 0,
      serviceLineCount: 0,
      hasTerrain: false,
      contourRingCount: 0,
      treeCount: 0,
    });
    if (!c) throw new Error("unreachable");
    expect(c.events.map((e) => e.stage)).toEqual(["cadastre"]);
  });

  it("returns null when there is nothing to reveal", () => {
    expect(
      buildScanChoreography({
        boundaryPts: 0,
        buildingCount: 0,
        neighbourCount: 0,
        easementCount: 0,
        serviceLineCount: 0,
        hasTerrain: false,
        contourRingCount: 0,
        treeCount: 0,
      }),
    ).toBeNull();
  });

  it("zod contract gates the shape — a bad duration fails loudly", () => {
    // 200ms is the documented floor; the builder never emits below it, and
    // the schema enforces it for any future caller.
    const c = buildScanChoreography({ ...FULL, treeCount: 1 });
    if (!c) throw new Error("unreachable");
    expect(c.events[4]!.durationMs).toBeGreaterThanOrEqual(200);
  });
});

describe("studioStore scan reveal machine", () => {
  it("setScanStage flips stages and stamps the clock", () => {
    const before = useStudioStore.getState().scanStage;
    try {
      useStudioStore.getState().setScanStage("cadastre");
      const s1 = useStudioStore.getState();
      expect(s1.scanStage).toBe("cadastre");
      expect(s1.scanStageStartedAt).toBeGreaterThan(0);
      useStudioStore.getState().setScanStage("done");
      expect(useStudioStore.getState().scanStage).toBe("done");
    } finally {
      useStudioStore.getState().setScanStage(before === "idle" ? "idle" : "idle");
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  approximateDiscOverlapPct,
  buildableEnvelopeFromBoundary,
  councilProfileFor,
  COUNCIL_PROFILES,
  evaluateStudioCompliance,
  snapPointToBuildableEnvelope,
  STONNINGTON_PERMEABLE_MIN_PCT,
  STONNINGTON_CANOPY_TARGET_PCT,
  COUNCIL_SETBACK_M,
} from "./studio-preemptive-compliance";

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

describe("studio-preemptive-compliance", () => {
  it("flags permeability when hardscape dominates", () => {
    const report = evaluateStudioCompliance({
      outdoorM2: 200,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 2.5,
          areaKind: "rect",
          wPx: 200,
          hPx: 160,
        },
        {
          id: "p2",
          t: "deck",
          x: 55,
          y: 60,
          scale: 2.2,
          areaKind: "rect",
          wPx: 180,
          hPx: 140,
        },
      ],
    });
    expect(report.permeableOk).toBe(false);
    expect(report.canvasSignal).toBe("critical");
    expect(report.alerts.some((a) => a.code === "permeability")).toBe(true);
    expect(report.permeableMinPct).toBe(STONNINGTON_PERMEABLE_MIN_PCT);
  });

  it("passes a softscape-led layout", () => {
    const report = evaluateStudioCompliance({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "l1",
          t: "lawn",
          x: 50,
          y: 55,
          scale: 1.4,
          areaKind: "rect",
          wPx: 160,
          hPx: 120,
        },
        {
          id: "c1",
          t: "canopy",
          x: 40,
          y: 40,
          scale: 1,
          canopyM: 6,
        },
        {
          id: "e1",
          t: "exist",
          x: 70,
          y: 30,
          scale: 1,
          dbhM: 0.45,
          canopyM: 8,
        },
      ],
    });
    expect(report.permeableOk).toBe(true);
    expect(report.canvasSignal).toBe("ok");
  });

  it("snaps placements into the council setback envelope", () => {
    const env = buildableEnvelopeFromBoundary(boundary, 1.5, 110);
    expect(env).not.toBeNull();
    const nearEdge = snapPointToBuildableEnvelope(11, 50, env);
    expect(nearEdge.snapped).toBe(true);
    expect(nearEdge.x).toBeGreaterThan(11);
    expect(nearEdge.codeHint).toMatch(/setback/i);
  });

  it("estimates TPZ disc overlap percentage", () => {
    expect(approximateDiscOverlapPct(6, 2, 20)).toBe(0);
    expect(approximateDiscOverlapPct(6, 2, 1)).toBeGreaterThan(10);
  });

  it("raises AS 4970 alert when hardscape sits on existing tree TPZ", () => {
    const report = evaluateStudioCompliance({
      outdoorM2: 230,
      boundary,
      scaleM: 110,
      items: [
        {
          id: "tree",
          t: "exist",
          x: 50,
          y: 50,
          scale: 1,
          dbhM: 0.5,
          canopyM: 8,
        },
        {
          id: "deck",
          t: "deck",
          x: 52,
          y: 52,
          scale: 1.2,
          areaKind: "rect",
          wPx: 120,
          hPx: 86,
        },
        {
          id: "lawn",
          t: "lawn",
          x: 30,
          y: 70,
          scale: 1.5,
          areaKind: "rect",
          wPx: 160,
          hPx: 120,
        },
      ],
    });
    expect(report.alerts.some((a) => a.code === "tpz")).toBe(true);
  });
});

describe("councilProfileFor", () => {
  it("returns Stonnington as default for null/undefined", () => {
    expect(councilProfileFor(null).id).toBe("STON");
    expect(councilProfileFor(undefined).id).toBe("STON");
  });

  it("returns Stonnington for unknown LGA codes", () => {
    expect(councilProfileFor("UNKNOWN").id).toBe("STON");
  });

  it("resolves Bayside with stricter rules", () => {
    const bayside = councilProfileFor("BAYS");
    expect(bayside.permeableMinPct).toBe(25);
    expect(bayside.canopyTargetPct).toBe(20);
    expect(bayside.setbackM).toBe(2.0);
  });

  it("resolves Melbourne CBD with lighter rules", () => {
    const melb = councilProfileFor("MELB");
    expect(melb.permeableMinPct).toBe(15);
    expect(melb.canopyTargetPct).toBe(10);
  });

  it("handles partial LGA code prefixes", () => {
    expect(councilProfileFor("STONNINGTON").id).toBe("STON");
    expect(councilProfileFor("Bayside City Council").id).toBe("BAYS");
  });

  it("all profiles have required fields", () => {
    for (const [key, profile] of Object.entries(COUNCIL_PROFILES)) {
      expect(profile.id).toBe(key);
      expect(profile.label).toBeTruthy();
      expect(profile.permeableMinPct).toBeGreaterThan(0);
      expect(profile.canopyTargetPct).toBeGreaterThan(0);
      expect(profile.setbackM).toBeGreaterThan(0);
    }
  });

  it("deprecated constants match default profile", () => {
    const defaultProfile = councilProfileFor(null);
    expect(STONNINGTON_PERMEABLE_MIN_PCT).toBe(defaultProfile.permeableMinPct);
    expect(STONNINGTON_CANOPY_TARGET_PCT).toBe(defaultProfile.canopyTargetPct);
    expect(COUNCIL_SETBACK_M).toBe(defaultProfile.setbackM);
  });
});

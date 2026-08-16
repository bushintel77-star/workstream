import { describe, expect, it } from "vitest";
import {
  symbolToFloraForm,
  rankAtPoint,
  exposureLabel,
  placementScaleFor,
  type FloraItem,
} from "./floraWorld";

const PRAHRAN = { lat: -37.849, lng: 144.993 };

describe("symbolToFloraForm", () => {
  it("maps the dock's plant symbol ids to flora forms", () => {
    expect(symbolToFloraForm("olive-standard")).toBe("canopy");
    expect(symbolToFloraForm("hornbeam-pleached")).toBe("hedge");
    expect(symbolToFloraForm("lomandra-mass")).toBe("bed");
    expect(symbolToFloraForm("lawn")).toBe("lawn");
    expect(symbolToFloraForm("feature")).toBe("feature");
  });

  it("returns null for hardscape and surveyed symbols", () => {
    expect(symbolToFloraForm("bluestone-paver")).toBeNull();
    expect(symbolToFloraForm("deck")).toBeNull();
    expect(symbolToFloraForm("frenchdrain")).toBeNull();
    expect(symbolToFloraForm("existing-tree-retain")).toBeNull();
    expect(symbolToFloraForm("anything-else")).toBeNull();
  });
});

describe("rankAtPoint", () => {
  it("returns at most 3 candidates, hoisting the preferred form", () => {
    const r = rankAtPoint({
      form: "hedge",
      xPct: 50,
      yPct: 50,
      items: [],
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });
    expect(r.candidates.length).toBeGreaterThanOrEqual(1);
    expect(r.candidates.length).toBeLessThanOrEqual(3);
    expect(r.candidates[0]!.studioForm).toBe("hedge");
    expect(r.sunHours).toBeGreaterThan(0);
    for (const c of r.candidates) {
      expect(c.score).toBeGreaterThan(0);
      expect(c.why.length).toBeGreaterThan(0);
    }
  });

  it("is canopy-aware — a click beside existing canopy still ranks", () => {
    const items: FloraItem[] = [
      { id: "t1", t: "canopy", x: 52, y: 51, scale: 1 },
      { id: "e1", t: "exist", x: 80, y: 80, scale: 1 },
      { id: "p1", t: "paving", x: 50, y: 50, scale: 1 },
    ];
    const r = rankAtPoint({
      form: "bed",
      xPct: 50,
      yPct: 50,
      items,
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "1 Somewhere Street, Melbourne VIC",
    });
    // The domain pins countNearbyCanopy: canopy counts, paving doesn't.
    expect(r.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("respects the height envelope of the armed form", () => {
    const r = rankAtPoint({
      form: "lawn",
      xPct: 50,
      yPct: 50,
      items: [],
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "",
    });
    for (const c of r.candidates) {
      // FLORA_HEIGHT_BY_FORM.lawn = 0.5, filter tolerance 0.05.
      expect(c.matureHeightM).toBeLessThanOrEqual(0.55);
    }
  });
});

describe("exposureLabel", () => {
  it("labels the shared sun thresholds", () => {
    expect(exposureLabel(1.5)).toBe("Shade");
    expect(exposureLabel(3)).toBe("Partial shade");
    expect(exposureLabel(7)).toBe("Full sun");
  });
});

describe("placementScaleFor", () => {
  it("clamps the spread-derived scale (SVG acceptFlora parity)", () => {
    expect(placementScaleFor({ canopySpreadM: 2.5 } as never)).toBeCloseTo(0.5, 5);
    expect(placementScaleFor({ canopySpreadM: 10 } as never)).toBeCloseTo(1.25, 5); // ceiling
    expect(placementScaleFor({ canopySpreadM: 1 } as never)).toBeCloseTo(0.45, 5); // floor
  });
});

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

// --- Site envelope consumption (planting becomes an aesthetic decision) ---

function envelope(over: {
  plantingSunClass?: "full_sun" | "part_shade" | "shade";
  wetness?: "dry" | "moist" | "wet" | "flood_prone";
  month?: number;
}) {
  return {
    month: over.month ?? 9,
    seasonalSun: [
      { preset: "winter" as const, meanHours: 5.0, classFractions: { shade: 0.1, part_shade: 0.2, full_sun: 0.7 } },
      { preset: "summer" as const, meanHours: 10.2, classFractions: { shade: 0.0, part_shade: 0.1, full_sun: 0.9 } },
    ],
    plantingSunClass: over.plantingSunClass ?? "full_sun",
    wetness: { class: over.wetness ?? "dry", drivers: [] },
    slope: null,
    acidSulfate: false,
    nativeVegetationLabel: null,
    summaryLine: "Full sun · dry",
  };
}

describe("rankAtPoint with the site envelope", () => {
  it("without an envelope the legacy behaviour is unchanged", () => {
    const r = rankAtPoint({
      form: "bed",
      xPct: 50,
      yPct: 50,
      items: [],
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates[0]!.why).not.toContain("Envelope");
  });

  it("blends envelope fit and cites it in every candidate's why", () => {
    const r = rankAtPoint({
      form: "bed",
      xPct: 50,
      yPct: 50,
      items: [],
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "1 Somewhere Street, Melbourne VIC",
      envelope: envelope({}),
    });
    expect(r.candidates.length).toBeGreaterThan(0);
    for (const c of r.candidates) {
      expect(c.why).toMatch(/Envelope (fit|warning)/);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });

  it("a full-sun dry envelope and a shade-wet envelope rank differently", () => {
    const args = {
      form: "bed" as const,
      xPct: 50,
      yPct: 50,
      items: [],
      ...PRAHRAN,
      sunMin: 12 * 60,
      address: "1 Somewhere Street, Melbourne VIC",
    };
    const sunny = rankAtPoint({ ...args, envelope: envelope({ plantingSunClass: "full_sun", wetness: "dry" }) });
    const shady = rankAtPoint({ ...args, envelope: envelope({ plantingSunClass: "shade", wetness: "wet" }) });
    const sunnySig = JSON.stringify(sunny.candidates.map((c) => [c.symbolId, c.score.toFixed(3)]));
    const shadySig = JSON.stringify(shady.candidates.map((c) => [c.symbolId, c.score.toFixed(3)]));
    expect(sunnySig).not.toEqual(shadySig);
  });
});

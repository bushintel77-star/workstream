import { describe, expect, it } from "vitest";
import type { DesignKeylessOverlay } from "@workstream/contracts";
import { RESCODE_A2_6, type CanopyComplianceAssessment } from "@workstream/domain";
import type { CanopyComplianceResult } from "./canopyCompliance";
import { buildCanopyObligationChip, buildWfsOverlayChips } from "./WfsChips";

const ov = (
  kind: DesignKeylessOverlay["kind"],
  label?: string,
): DesignKeylessOverlay =>
  ({ kind, rings: [], ...(label ? { label } : {}) }) as DesignKeylessOverlay;

function canopyResult(
  assessment: CanopyComplianceAssessment,
): CanopyComplianceResult {
  return {
    assessment,
    overhangingCount: 0,
    outsideCount: 0,
    areaDisagreement: false,
  };
}

const CANOPY_UNKNOWN = canopyResult({
  status: "insufficient-data",
  required: null,
  standard: RESCODE_A2_6,
});
const CANOPY_COMPLIANT = canopyResult({
  status: "compliant",
  required: 2,
  provided: 3,
  matureProvided: 2,
  immature: [],
  shortfall: 0,
  standard: RESCODE_A2_6,
});
const CANOPY_SHORTFALL = canopyResult({
  status: "shortfall",
  required: 3,
  provided: 1,
  matureProvided: 1,
  immature: [],
  shortfall: 2,
  standard: RESCODE_A2_6,
});

describe("buildWfsOverlayChips", () => {
  it("produces no chips from absent overlays (zero-mock law)", () => {
    expect(buildWfsOverlayChips([], 0)).toEqual([]);
  });

  it("labels the planning zone from the overlay label", () => {
    const chips = buildWfsOverlayChips([ov("planning", "GRZ10")], 0);
    expect(chips).toMatchObject([{ id: "planning", label: "GRZ10 Zone" }]);
    expect(chips[0]!.title).toContain("Vicmap");
  });

  it("marks dig/life-safety overlays as hazards with the triangle glyph", () => {
    const chips = buildWfsOverlayChips(
      [
        ov("bushfire", "BAL-12.5"),
        ov("flood", "Overland Flow"),
        ov("water_corp"),
        ov("acid_sulfate"),
      ],
      0,
    );
    for (const c of chips) {
      expect(c.hazard).toBe(true);
      expect(c.glyph).toBe("▲");
    }
    expect(chips.map((c) => c.id)).toEqual([
      "bushfire",
      "flood",
      "water_corp",
      "acid_sulfate",
    ]);
  });

  it("counts title easement rings into one dig-safety pill", () => {
    const two = buildWfsOverlayChips([], 2);
    expect(two).toMatchObject([
      { id: "easement", label: "2 Easements", glyph: "▲", hazard: true },
    ]);
    expect(two[0]!.title).toContain("Vicmap");
    expect(buildWfsOverlayChips([], 1)).toMatchObject([
      { id: "easement", label: "1 Easement", glyph: "▲", hazard: true },
    ]);
  });

  it("falls back to keyless easement washes when no ring count is given", () => {
    const chips = buildWfsOverlayChips([ov("easement")], 0);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "easement", hazard: true });
  });

  it("keeps heritage, road casement, wetland and canopy neutral", () => {
    const chips = buildWfsOverlayChips(
      [
        ov("heritage", "HO128"),
        ov("road_casement"),
        ov("wetland"),
        ov("urban_tree", "Canopy A2–6"),
      ],
      0,
    );
    expect(chips.map((c) => c.id)).toEqual([
      "heritage",
      "road_casement",
      "wetland",
      "canopy",
    ]);
    expect(chips.every((c) => !c.hazard)).toBe(true);
    expect(chips[0]).toMatchObject({ id: "heritage", label: "HO128 Heritage" });
    expect(chips[3]).toMatchObject({ id: "canopy", label: "Canopy A2–6" });
  });

  it("stamps every derived overlay pill with the Vicmap provenance + boundary caveat", () => {
    const chips = buildWfsOverlayChips(
      [ov("planning", "GRZ10"), ov("bushfire", "BAL-12.5"), ov("easement")],
      0,
    );
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.title).toContain("Vicmap authoritative overlay");
      expect(c.title).toContain("beyond the title line");
    }
  });

  it("emits no chip for contour washes (rendered as scene line work)", () => {
    expect(buildWfsOverlayChips([ov("contour")], 0)).toEqual([]);
  });

  it("allows an explicit empty chip list to suppress derived overlays", () => {
    expect(buildWfsOverlayChips([], 0)).toEqual([]);
  });
});

describe("A2-6 canopy obligation pill", () => {
  it("shows the bare standard when the site area is unknown", () => {
    expect(buildCanopyObligationChip(CANOPY_UNKNOWN)).toEqual({
      id: "a26-canopy",
      label: "A2-6",
      title: expect.stringContaining("area unknown"),
    });
  });

  it("carries the provided/required count when compliant, without hazard marks", () => {
    const chip = buildCanopyObligationChip(CANOPY_COMPLIANT)!;
    expect(chip).toMatchObject({ id: "a26-canopy", label: "A2-6 2/2" });
    expect(chip.hazard).toBeUndefined();
    expect(chip.title).toContain("met");
  });

  it("surfaces the shortfall count in the label and tooltip", () => {
    const chip = buildCanopyObligationChip(CANOPY_SHORTFALL)!;
    expect(chip.label).toBe("A2-6 1/3");
    expect(chip.title).toContain("2 more canopy trees required");
  });

  it("emits nothing without canopy data (zero-mock law)", () => {
    expect(buildCanopyObligationChip(null)).toBeNull();
    expect(buildCanopyObligationChip(undefined)).toBeNull();
  });

  it("lights the obligation even with no keyless canopy overlay", () => {
    const chips = buildWfsOverlayChips([], 0, CANOPY_SHORTFALL);
    expect(chips).toEqual([
      { id: "a26-canopy", label: "A2-6 1/3", title: expect.stringContaining("2 more") },
    ]);
  });

  it("keeps both a keyless canopy wash and the computed obligation", () => {
    const chips = buildWfsOverlayChips([ov("urban_tree", "Canopy A2–6")], 0, CANOPY_COMPLIANT);
    expect(chips.map((c) => c.id)).toEqual(["canopy", "a26-canopy"]);
  });
});
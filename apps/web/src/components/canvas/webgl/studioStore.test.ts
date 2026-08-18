/**
 * seasonProgress is now DERIVED from (sunDatePreset, sunMin) and the domain's
 * melbourneSeason() is the single season-label authority. These tests pin both
 * properties so a future free-floating scrubber or label table cannot creep
 * back in and desync the toolbar from the rendered sun.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CanvasStroke,
  PhotoElevation,
} from "@workstream/contracts";
import {
  melbourneSeasonFromSun,
  seasonProgressFromSun,
  useStudioStore,
} from "./studioStore";

// Fixed instants so "today" is deterministic (Melbourne wall-clock).
const AUG_NOON = new Date("2026-08-17T02:00:00Z"); // 12:00 AEST
const JAN_NOON = new Date("2026-01-01T01:00:00Z"); // 12:00 AEDT

describe("seasonProgressFromSun", () => {
  it("peaks the winter envelope at the June solstice (~0.47)", () => {
    expect(seasonProgressFromSun("winter", 12 * 60, AUG_NOON)).toBeCloseTo(
      0.47,
      1,
    );
  });

  it("peaks the summer envelope at the December solstice (~0.97)", () => {
    expect(seasonProgressFromSun("summer", 12 * 60, AUG_NOON)).toBeCloseTo(
      0.97,
      1,
    );
  });

  it("is near zero on Jan 1 and monotonic through the year", () => {
    expect(seasonProgressFromSun("today", 12 * 60, JAN_NOON)).toBeLessThan(0.01);
    expect(
      seasonProgressFromSun("march-equinox", 12 * 60, AUG_NOON),
    ).toBeGreaterThan(
      seasonProgressFromSun("today", 12 * 60, JAN_NOON),
    );
  });
});

describe("melbourneSeasonFromSun", () => {
  it("delegates season naming to the domain authority (SH labels)", () => {
    expect(melbourneSeasonFromSun("winter", 12 * 60, AUG_NOON).label).toContain(
      "winter",
    );
    expect(melbourneSeasonFromSun("winter", 12 * 60, AUG_NOON).month).toBe(
      "June",
    );
    expect(melbourneSeasonFromSun("summer", 12 * 60, AUG_NOON).label).toContain(
      "summer",
    );
  });

  it("agrees with the wall clock for the same instant", () => {
    const meta = melbourneSeasonFromSun("today", 12 * 60, AUG_NOON);
    expect(meta.label).toBe("Late winter");
    expect(meta.month).toBe("August");
  });
});

describe("studioStore temporal derivation", () => {
  afterEach(() => {
    // Reset the singleton so a mutated test cannot leak into the next one.
    useStudioStore.setState({
      sunDatePreset: "today",
      sunMin: 12 * 60,
      seasonProgress: seasonProgressFromSun("today", 12 * 60, AUG_NOON),
    });
  });

  it("recomputes seasonProgress from the sun date on setSunDatePreset", () => {
    useStudioStore.getState().setSunDatePreset("winter");
    expect(useStudioStore.getState().seasonProgress).toBeCloseTo(0.47, 1);
  });

  it("recomputes seasonProgress from the sun date on setSunMin", () => {
    const s = useStudioStore.getState();
    s.setSunDatePreset("winter");
    s.setSunMin(12 * 60 + 5 * 60); // 17:00 same day — still winter envelope
    expect(useStudioStore.getState().seasonProgress).toBeCloseTo(0.47, 1);
  });
});

/* -------------------------------------------------------------------------- */
/* Sketch → CAD + selection slices                                            */
/* -------------------------------------------------------------------------- */

const BOUNDARY = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];
const BUILDING = [
  { x: 30, y: 10 },
  { x: 70, y: 10 },
  { x: 70, y: 30 },
  { x: 30, y: 30 },
];

function inkStroke(id: string, points: Array<[number, number]>): CanvasStroke {
  return {
    id,
    points: points.map(([x_pct, y_pct]) => ({ x_pct, y_pct })),
    color: "#ff2ef6",
    width_px: 2.5,
    kind: "ink",
  };
}

function elevationWithStrokes(id: string, strokeCount: number): PhotoElevation {
  return {
    id,
    photo_id: "photo-1",
    name: "Front facade",
    uri: "https://example.com/p.jpg",
    natural_aspect: 1.5,
    azimuth_deg: 0,
    calibration: null,
    centre_x_m: 0,
    centre_z_m: 0,
    ground_offset_m: 0,
    boundary_snap: null,
    strokes: Array.from({ length: strokeCount }, (_, i) => ({
      id: `ps-${i}`,
      points: [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 1 },
      ],
      width_px: 2,
      color: "#0030CF",
    })),
    created_at: "2026-08-18T00:00:00.000Z",
    updated_at: "2026-08-18T00:00:00.000Z",
  };
}

/** Reset every slice these tests mutate (the store is a module singleton). */
function resetStore() {
  useStudioStore.setState({
    siteBoundary: [],
    siteBuilding: [],
    features: [],
    placements: [],
    sketchStrokes: [],
    photoElevations: [],
    cadProposals: [],
    cadReviewOpen: false,
    cadActiveProposalId: null,
    sketchCadNotice: null,
    selection: [],
    historyPast: [],
    historyFuture: [],
  });
}

describe("studioStore sketch → CAD slices", () => {
  afterEach(resetStore);

  it("tidySketchToCad populates confidence-scored proposals + opens the review", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(BOUNDARY, BUILDING);
    store.setSketchStrokes([inkStroke("a", [[12, 80], [12, 60], [12, 40]])]);
    store.tidySketchToCad();

    const s = useStudioStore.getState();
    expect(s.cadProposals.length).toBeGreaterThan(0);
    expect(s.cadProposals[0]!.confidence).toBeGreaterThan(0);
    expect(s.cadReviewOpen).toBe(true);
    expect(s.cadActiveProposalId).toBe(s.cadProposals[0]!.id);
    expect(s.sketchCadNotice).toContain("Formalized");
  });

  it("tidy with no strokes reports the honest empty notice", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(BOUNDARY, BUILDING);
    store.tidySketchToCad();
    const s = useStudioStore.getState();
    expect(s.cadProposals).toEqual([]);
    expect(s.cadReviewOpen).toBe(false);
    expect(s.sketchCadNotice).toContain("No convertible strokes");
  });

  it("tidy stamps photo-trace strokes as scoped out (never silent)", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(BOUNDARY, BUILDING);
    store.setSketchStrokes([inkStroke("a", [[12, 80], [12, 60], [12, 40]])]);
    store.setPhotoElevations([elevationWithStrokes("elev-1", 3)]);
    store.tidySketchToCad();
    const s = useStudioStore.getState();
    expect(s.sketchCadNotice).toContain("3 photo-traced strokes");
    expect(s.sketchCadNotice).toContain("not converted to CAD");
  });

  it("acceptCadProposal mints a placement + mirrored polygon feature, undoable", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(BOUNDARY, BUILDING);
    store.setSketchStrokes([
      inkStroke("deck", [[40, 70], [60, 70], [62, 84], [38, 84], [40, 70]]),
    ]);
    store.tidySketchToCad();
    const proposal = useStudioStore.getState().cadProposals[0]!;

    const before = useStudioStore.getState().placements.length;
    store.acceptCadProposal(proposal.id);
    const s = useStudioStore.getState();
    expect(s.cadProposals).toEqual([]);
    expect(s.placements.length).toBe(before + 1);
    const placement = s.placements[s.placements.length - 1]!;
    expect(placement.symbol_id).toBe(proposal.symbol_id);
    if (proposal.outlinePct) {
      const mirror = s.features.find((f) => f.id === placement.id);
      expect(mirror).toBeDefined();
      expect(mirror!.geometry.type).toBe("Polygon");
    }
    // Undo restores the pre-accept doc (history committed once).
    store.undo();
    expect(useStudioStore.getState().placements.length).toBe(before);
    expect(useStudioStore.getState().features.length).toBe(0);
  });

  it("rejectCadProposal drops one; acceptAllCadProposals commits the rest", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(BOUNDARY, BUILDING);
    store.setSketchStrokes([
      inkStroke("h1", [[12, 80], [12, 60], [12, 40]]),
      inkStroke("h2", [[88, 80], [88, 60], [88, 40]]),
    ]);
    store.tidySketchToCad();
    const first = useStudioStore.getState().cadProposals[0]!;
    store.rejectCadProposal(first.id);
    expect(useStudioStore.getState().cadProposals).toHaveLength(1);
    store.acceptAllCadProposals();
    const s = useStudioStore.getState();
    expect(s.cadProposals).toEqual([]);
    expect(s.cadReviewOpen).toBe(false);
    expect(s.placements).toHaveLength(1);
  });

  it("convertStrokesToCadFeatures persists real features and keeps the ink", () => {
    const store = useStudioStore.getState();
    store.setSketchStrokes([inkStroke("ditch", [[20, 50], [40, 50]])]);
    const converted = store.convertStrokesToCadFeatures();
    const s = useStudioStore.getState();
    expect(converted).toBe(1);
    expect(s.features).toHaveLength(1);
    expect(s.sketchStrokes).toHaveLength(1); // ink kept — provenance
    expect(s.sketchCadNotice).toContain("ink stays as reference");
  });

  it("convertStrokesToCadFeatures reports the honest miss", () => {
    const store = useStudioStore.getState();
    store.setSketchStrokes([inkStroke("w", [[10, 10], [11, 12], [9, 13]])]);
    expect(store.convertStrokesToCadFeatures()).toBe(0);
    expect(useStudioStore.getState().features).toEqual([]);
    expect(useStudioStore.getState().sketchCadNotice).toContain("No strokes recognised");
  });
});

describe("studioStore selection slice", () => {
  afterEach(resetStore);

  it("selectRef replaces by default and accumulates with additive", () => {
    const store = useStudioStore.getState();
    store.selectRef({ kind: "placement", id: "a" });
    expect(useStudioStore.getState().selection).toEqual([
      { kind: "placement", id: "a" },
    ]);
    store.selectRef({ kind: "placement", id: "b" });
    expect(useStudioStore.getState().selection).toEqual([
      { kind: "placement", id: "b" },
    ]);
    store.selectRef({ kind: "feature", id: "c" }, { additive: true });
    expect(useStudioStore.getState().selection).toEqual([
      { kind: "placement", id: "b" },
      { kind: "feature", id: "c" },
    ]);
  });

  it("toggleSelectRef flips membership; clearSelection empties", () => {
    const store = useStudioStore.getState();
    store.selectRef({ kind: "feature", id: "f1" });
    store.toggleSelectRef({ kind: "feature", id: "f2" });
    expect(useStudioStore.getState().selection).toHaveLength(2);
    store.toggleSelectRef({ kind: "feature", id: "f2" });
    expect(useStudioStore.getState().selection).toEqual([
      { kind: "feature", id: "f1" },
    ]);
    store.clearSelection();
    expect(useStudioStore.getState().selection).toEqual([]);
  });

  it("selection persists across mode switches and camera pitch writes", () => {
    const store = useStudioStore.getState();
    store.selectRef({ kind: "placement", id: "keep-me" });
    store.setSketchMode(true);
    store.setPitchDeg(76);
    store.setSketchMode(false);
    expect(useStudioStore.getState().selection).toEqual([
      { kind: "placement", id: "keep-me" },
    ]);
  });

  it("undo prunes selection refs whose entities left the document", () => {
    const store = useStudioStore.getState();
    store.commitHistory(); // snapshot: empty doc
    store.addPlacement({
      id: "p-keep",
      symbol_id: "olive-standard",
      x_pct: 50,
      y_pct: 50,
      rotation_deg: 0,
      scale: 1,
    });
    store.selectRef({ kind: "placement", id: "p-keep" });
    expect(useStudioStore.getState().selection).toHaveLength(1);
    store.undo(); // restores the empty snapshot — the ref must prune
    expect(useStudioStore.getState().placements).toEqual([]);
    expect(useStudioStore.getState().selection).toEqual([]);
  });
});

describe("inspector edits (updatePlacementField / updateFeatureField)", () => {
  const SQUARE = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ];

  beforeEach(() => {
    useStudioStore.setState({
      placements: [],
      features: [],
      siteBoundary: [],
      siteBuilding: [],
      boundaryNotice: null,
      historyPast: [],
      historyFuture: [],
    });
  });

  it("attribute-only edits persist directly — no clamp, no notice", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(SQUARE, []);
    store.setPlacements([
      {
        id: "p-out",
        symbol_id: "bluestone-paver",
        x_pct: 2, // outside the ring — direct-persist fields must NOT clamp
        y_pct: 50,
        rotation_deg: 0,
        scale: 1,
      },
    ]);
    store.updatePlacementField("p-out", { label: "Courtyard" });
    store.updatePlacementField("p-out", { height_m: 2.4 });
    const p = useStudioStore.getState().placements[0]!;
    expect(p.label).toBe("Courtyard");
    expect(p.height_m).toBe(2.4);
    expect(p.x_pct).toBe(2); // untouched — locked classification
    expect(useStudioStore.getState().boundaryNotice).toBeNull();
  });

  it("geometry-affecting edits re-clamp the centre and raise a notice", () => {
    const store = useStudioStore.getState();
    store.setSiteContext(SQUARE, []);
    store.setPlacements([
      {
        id: "p-out",
        symbol_id: "bluestone-paver",
        x_pct: 2,
        y_pct: 50,
        rotation_deg: 0,
        scale: 1,
      },
    ]);
    store.updatePlacementField("p-out", { scale: 2 });
    const s = useStudioStore.getState();
    const p = s.placements[0]!;
    expect(p.scale).toBe(2);
    expect(p.x_pct).toBeGreaterThan(2); // clamped onto the boundary
    expect(s.boundaryNotice?.refId).toBe("p-out");
    expect(s.boundaryNotice?.reason).toBeTruthy();
    s.dismissBoundaryNotice();
    expect(useStudioStore.getState().boundaryNotice).toBeNull();
  });

  it("geometry-affecting edits with no boundary pass through quietly", () => {
    const store = useStudioStore.getState();
    store.setPlacements([
      {
        id: "p-in",
        symbol_id: "bluestone-paver",
        x_pct: 50,
        y_pct: 50,
        rotation_deg: 0,
        scale: 1,
      },
    ]);
    store.updatePlacementField("p-in", { canopy_radius_m: 3.5 });
    const p = useStudioStore.getState().placements[0]!;
    expect(p.canopy_radius_m).toBe(3.5);
    expect(p.x_pct).toBe(50);
    expect(useStudioStore.getState().boundaryNotice).toBeNull();
  });

  it("feature edits merge, mark human_locked, and are undoable", () => {
    const store = useStudioStore.getState();
    const feature = {
      id: "f-1",
      type: "LandscapeFeature" as const,
      metadata: {
        layer: "hardscape" as const,
        friendly_name: "Path",
        timestamp_created: "2026-08-18T00:00:00.000Z",
        source_attribution: "human_drawn" as const,
        user_modification_state: "draft" as const,
      },
      geometry: {
        type: "LineString" as const,
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: [
          { id: "f-1-v0", pct: { x_pct: 10, y_pct: 20 } },
          { id: "f-1-v1", pct: { x_pct: 30, y_pct: 40 } },
        ],
      },
      material_fill: {
        type: "surface" as const,
        sku: "PAVE-BLUESTONE",
        depth_m: 0.075,
        waste_allocation_pct: 10,
      },
    };
    store.setFeatures([feature]);
    store.updateFeatureField("f-1", {
      friendly_name: "Front path",
      material_fill: { sku: "PAVE-GRANITE" },
    });
    const f = useStudioStore.getState().features[0]!;
    expect(f.metadata.friendly_name).toBe("Front path");
    expect(f.material_fill?.sku).toBe("PAVE-GRANITE");
    expect(f.material_fill?.depth_m).toBe(0.075); // untouched fields survive
    expect(f.metadata.user_modification_state).toBe("human_locked");
    expect(useStudioStore.getState().historyPast).toHaveLength(1);
  });

  it("section patches never fabricate absent sections", () => {
    const store = useStudioStore.getState();
    store.setFeatures([
      {
        id: "f-bare",
        type: "LandscapeFeature" as const,
        metadata: {
          layer: "softscape_beds" as const,
          timestamp_created: "2026-08-18T00:00:00.000Z",
          source_attribution: "human_drawn" as const,
          user_modification_state: "draft" as const,
        },
        geometry: {
          type: "Polygon" as const,
          spatial_reference: "EPSG:3857",
          canvas_origin_pct: { x_pct: 0, y_pct: 0 },
          points: [
            { id: "f-bare-v0", pct: { x_pct: 10, y_pct: 10 } },
            { id: "f-bare-v1", pct: { x_pct: 20, y_pct: 10 } },
            { id: "f-bare-v2", pct: { x_pct: 20, y_pct: 20 } },
          ],
        },
      },
    ]);
    store.updateFeatureField("f-bare", {
      material_fill: { sku: "X" },
      brush_recipe_id: "Y",
    });
    const f = useStudioStore.getState().features[0]!;
    expect(f.material_fill).toBeUndefined();
    expect(f.procedural_scatter_contents).toBeUndefined();
    expect(f.metadata.user_modification_state).toBe("human_locked");
  });
});

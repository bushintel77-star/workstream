/**
 * WebGL sketch → CAD bridge tests — the two classifier paths, the proposal
 * → feature mirror, and the photo-trace scoping notice.
 */

import { describe, expect, it } from "vitest";
import type { CanvasStroke } from "@workstream/contracts";
import { LandscapeFeatureSchema } from "@workstream/contracts";
import {
  convertStrokesToFeatures,
  featureForAcceptedProposal,
  photoTraceScopeNotice,
  proposeSketchCad,
  proposalLabel,
} from "./sketchCad";

/** A simple rectangular lot with the house on the street side. */
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

function stroke(
  id: string,
  points: Array<[number, number]>,
  width_px = 2.5,
): CanvasStroke {
  return {
    id,
    points: points.map(([x_pct, y_pct]) => ({ x_pct, y_pct })),
    color: "#ff2ef6",
    width_px,
    kind: "ink",
  };
}

describe("proposeSketchCad (context-aware classifier)", () => {
  it("returns [] for empty input", () => {
    expect(proposeSketchCad([], { boundary: BOUNDARY, building: BUILDING })).toEqual([]);
  });

  it("classifies a long line along the boundary as a hedge screen", () => {
    const proposals = proposeSketchCad(
      [stroke("a", [[12, 80], [12, 60], [12, 40]])],
      { boundary: BOUNDARY, building: BUILDING },
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.symbol_id).toBe("hedge");
    expect(proposals[0]!.confidence).toBeGreaterThan(0.8);
    expect(proposals[0]!.reason).toContain("boundary");
    expect(proposals[0]!.rotDeg).toBe(90);
  });

  it("classifies a closed rear mass as a deck with a drawn outline", () => {
    const ring: Array<[number, number]> = [
      [40, 70], [60, 70], [62, 84], [38, 84], [40, 70],
    ];
    const proposals = proposeSketchCad(
      [stroke("deck", ring)],
      { boundary: BOUNDARY, building: BUILDING },
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.symbol_id).toBe("deck");
    expect(proposals[0]!.outlinePct?.length).toBeGreaterThanOrEqual(3);
  });

  it("disambiguates duplicate templated reasons with ordinals", () => {
    const dots = [
      stroke("d1", [[15, 60], [16, 60], [15.5, 61]]),
      stroke("d2", [[16, 62], [17, 62], [16.5, 63]]),
    ];
    const proposals = proposeSketchCad(dots, {
      boundary: BOUNDARY,
      building: BUILDING,
    });
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    const canopy = proposals.filter((p) => p.symbol_id === "canopy");
    const withOrdinal = canopy.filter((p) => /\(\d+ of \d+\)/.test(p.reason));
    expect(withOrdinal.length).toBeGreaterThan(0);
  });

  it("keeps proposal centres inside outdoor (lot − house)", () => {
    // A mark drawn on top of the house envelope gets pulled into outdoor.
    const proposals = proposeSketchCad(
      [stroke("h", [[50, 20], [52, 20], [51, 22]])],
      { boundary: BOUNDARY, building: BUILDING },
    );
    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    const insideHouse =
      p.x_pct > 30 && p.x_pct < 70 && p.y_pct > 10 && p.y_pct < 30;
    expect(insideHouse).toBe(false);
    expect(p.reason).toContain("outdoor");
  });

  it("never proposes from derived hatch fills (decorative shading)", () => {
    const hatchStroke: CanvasStroke = {
      ...stroke("hatch-1", [[20, 20], [80, 20]]),
      nib: "ink-03",
      hatch: { of: "parent-1", angle_deg: 90, spacing_pct: 0.5 },
    };
    const proposals = proposeSketchCad([hatchStroke], {
      boundary: BOUNDARY,
      building: BUILDING,
    });
    expect(proposals).toEqual([]);
  });
});

describe("convertStrokesToFeatures (direct one-click path)", () => {
  it("converts a thin straight stroke into a ditch feature with valid schema", () => {
    const { features, converted, skipped } = convertStrokesToFeatures([
      stroke("ditch", [[20, 50], [40, 50]]),
    ]);
    expect(converted).toBe(1);
    expect(skipped).toBe(0);
    expect(features).toHaveLength(1);
    expect(features[0]!.metadata.friendly_name).toContain("French drain");
    expect(LandscapeFeatureSchema.safeParse(features[0]!).success).toBe(true);
  });

  it("closes a bed loop so the polygon round-trips", () => {
    const ring = stroke("bed", [[20, 40], [40, 40], [40, 60], [20, 60], [20, 40]]);
    const { features } = convertStrokesToFeatures([ring]);
    expect(features).toHaveLength(1);
    const f = features[0]!;
    expect(f.geometry.type).toBe("Polygon");
    const first = f.geometry.points[0]!.pct;
    const last = f.geometry.points[f.geometry.points.length - 1]!.pct;
    expect(first.x_pct).toBe(last.x_pct);
    expect(first.y_pct).toBe(last.y_pct);
  });

  it("skips strokes below the confidence gate and reports them", () => {
    const weird = stroke("w", [[10, 10], [11, 12], [9, 13]]);
    const { features, converted, skipped } = convertStrokesToFeatures([weird]);
    expect(converted).toBe(0);
    expect(skipped).toBe(1);
    expect(features).toEqual([]);
  });

  it("converts strokes to schema-valid features end-to-end", () => {
    const { features } = convertStrokesToFeatures([
      stroke("p", [[10, 10], [50, 12], [80, 10]]),
    ]);
    for (const f of features) {
      expect(LandscapeFeatureSchema.safeParse(f).success).toBe(true);
    }
  });

  it("converts ink drawn off the board into board-bounded features", () => {
    // Ink on the context ground past both board edges is legal; the feature
    // vertices it converts into are not, and an out-of-bounds vertex fails
    // every subsequent whole-canvas autosave.
    const { features, converted } = convertStrokesToFeatures([
      stroke("offboard", [[-194.37, 50], [-40, 50.2], [120, 168.04]]),
    ]);
    expect(converted).toBe(1);
    const f = features[0]!;
    for (const v of f.geometry.points) {
      expect(v.pct.x_pct).toBeGreaterThanOrEqual(0);
      expect(v.pct.x_pct).toBeLessThanOrEqual(100);
      expect(v.pct.y_pct).toBeGreaterThanOrEqual(0);
      expect(v.pct.y_pct).toBeLessThanOrEqual(100);
    }
    expect(LandscapeFeatureSchema.safeParse(f).success).toBe(true);
  });

  it("excludes derived hatch fills from conversion (decorative, not source ink)", () => {
    const hatchStroke: CanvasStroke = {
      ...stroke("hatch-1", [[20, 20], [80, 20]]),
      nib: "ink-03",
      hatch: { of: "parent-1", angle_deg: 90, spacing_pct: 0.5 },
    };
    const { converted, skipped } = convertStrokesToFeatures([hatchStroke]);
    expect(converted).toBe(0);
    expect(skipped).toBe(1);
    expect(hatchStroke.hatch).toBeDefined();
  });

  it("applies KIND_TO_PLANE defaults so BOTH paths land geometry at its plane", () => {
    // wall → massing (+4.0), as planeStack.KIND_TO_PLANE declares. The
    // default is applied inside convertStrokesToFeatures so the one-click
    // rail path gets it too — not just the HUD override path. (Wall
    // classification needs a thick short stroke: width ≥ 4px, len < 35%.)
    const { features } = convertStrokesToFeatures([
      stroke("wall-run", [[20, 50], [40, 50]], 4),
    ]);
    expect(features).toHaveLength(1);
    expect(features[0]!.metadata.friendly_name).toContain("Retaining wall");
    expect(features[0]!.plane_z_m).toBe(4.0);
    // Positioning at a plane is NOT a cut/fill pad — that is
    // extrude_height_m's meaning and overloading it turns a wall into an
    // earthworks mass.
    expect(features[0]!.extrude_height_m).toBeUndefined();
    expect(LandscapeFeatureSchema.safeParse(features[0]!).success).toBe(true);
  });

  it("keeps ground-plane kinds on grade (no plane_z_m stamp)", () => {
    const { features } = convertStrokesToFeatures([
      stroke("ditch-run", [[20, 50], [40, 50]]),
    ]);
    expect(features).toHaveLength(1);
    expect(features[0]!.plane_z_m).toBeUndefined();
  });

  it("honours an operator override in place of the classifier default", () => {
    const wall = stroke("wall-override", [[20, 50], [40, 50]], 4);
    const { features } = convertStrokesToFeatures(
      [wall],
      new Map([[wall.id, 1.5]]),
    );
    expect(features).toHaveLength(1);
    expect(features[0]!.plane_z_m).toBe(1.5);
  });
});

describe("featureForAcceptedProposal (placement ↔ feature mirror)", () => {
  it("returns null for point proposals without an outline", () => {
    expect(
      featureForAcceptedProposal("p1", {
        id: "x",
        symbol_id: "canopy",
        x_pct: 50,
        y_pct: 50,
        confidence: 0.88,
        reason: "tree",
      }),
    ).toBeNull();
  });

  it("mirrors the placement id onto the polygon feature (SVG itemsToFeatures coupling)", () => {
    const f = featureForAcceptedProposal("place-1", {
      id: "x",
      symbol_id: "deck",
      x_pct: 50,
      y_pct: 70,
      confidence: 0.9,
      reason: "deck",
      outlinePct: [
        { x: 40, y: 70 },
        { x: 60, y: 70 },
        { x: 62, y: 84 },
        { x: 38, y: 84 },
      ],
    });
    expect(f).not.toBeNull();
    expect(f!.id).toBe("place-1");
    expect(f!.geometry.type).toBe("Polygon");
    expect(f!.metadata.layer).toBe("hardscape");
    expect(LandscapeFeatureSchema.safeParse(f!).success).toBe(true);
  });
});

describe("photoTraceScopeNotice", () => {
  it("stamps the scoped-out photo-trace strokes visibly", () => {
    expect(photoTraceScopeNotice(1)).toContain("1 photo-traced stroke");
    expect(photoTraceScopeNotice(3)).toContain("3 photo-traced strokes");
    expect(photoTraceScopeNotice(3)).toContain("not converted to CAD");
  });
});

describe("proposalLabel", () => {
  it("labels the classifier vocabulary for operators", () => {
    expect(proposalLabel("frenchdrain")).toBe("French drain");
    expect(proposalLabel("unknown-symbol")).toBe("unknown-symbol");
  });
});

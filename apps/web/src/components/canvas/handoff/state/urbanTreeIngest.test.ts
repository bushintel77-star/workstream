import { describe, expect, it } from "vitest";
import { mergeUrbanTreeGhosts } from "./urbanTreeIngest";
import { resolveItemHeightM } from "../geometry/itemHeight";
import type { StudioSnapshot } from "./studioTypes";

function emptySnap(): StudioSnapshot {
  return {
    items: [],
    strokes: [],
    boundary: [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ],
    building: [],
    easements: [],
    services: [],
    levels: [],
    keylessOverlays: [],
    bydaAssets: [],
    irrigationZones: [],
    constructionTrenches: [],
    annotations: [],
    imageLayers: [],
    drainageRuns: [],
    pathCorridors: [],
  };
}

describe("mergeUrbanTreeGhosts", () => {
  it("places exist ghosts without inventing DBH", () => {
    const { snap, count } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [
        {
          x: 20,
          y: 30,
          canopy_radius_m: 4,
          height_m: 10,
          label: "Elm",
        },
      ],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    expect(count).toBe(1);
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost);
    expect(ghost).toBeTruthy();
    expect(ghost!.why).toMatch(/DBH/i);
    expect(ghost!.why).not.toMatch(/dbh\s*=/i);
  });

  it("persists the Vicmap height onto the item so the elevation can read it", () => {
    const { snap } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [{ x: 20, y: 30, canopy_radius_m: 4, height_m: 10.4 }],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost);
    expect(ghost!.heightM).toBe(10.4);
  });

  it("stamps the vicmap_tree source so it survives acceptance", () => {
    const { snap } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [{ x: 20, y: 30, canopy_radius_m: 4, height_m: 10.4 }],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost);
    expect(ghost!.source).toBe("vicmap_tree");
  });

  it("prints canopy diameter in the plan tooltip, not the radius", () => {
    const { snap } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [{ x: 20, y: 30, canopy_radius_m: 4.3, height_m: 10 }],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost);
    expect(ghost!.why).toContain("~8.6 m canopy spread");
  });

  /*
   * Reconciliation probe — same shape as the lot-area integrity probe
   * (measurement-integrity.test.ts). The plan tooltip reads the Vicmap height
   * out of `why`; the elevation board reads `resolveItemHeightM(item)`. Before
   * the fix the elevation fell back to BY_TYPE.exist.heightM (8 m) x a
   * canopy-derived scale, so one tree showed "~1 m high" on the plan and
   * 4.4-11.6 m on the elevation. Both surfaces must now derive from the same
   * Vicmap LiDAR value.
   */
  it("reconciles plan tooltip height with elevation height (one source)", () => {
    const vicmapHeightM = 10.4;
    const { snap } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [
        { x: 20, y: 30, canopy_radius_m: 4.3, height_m: vicmapHeightM },
      ],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost)!;
    // Plan tooltip source: the `why` string carries the Vicmap height.
    expect(ghost.why).toContain(`~${vicmapHeightM.toFixed(1)} m high`);
    // Elevation source: resolveItemHeightM reads the persisted heightM
    // directly (not 8 m x canopy scale).
    expect(resolveItemHeightM(ghost)).toBe(vicmapHeightM);
  });

  it("does not scale an authored exist-tree height by the canopy glyph scale", () => {
    // canopy_radius_m = 12 -> canopyRadiusToGlyphScale clamps to 1.45. Before
    // the fix the elevation drew 8 x 1.45 = 11.6 m for a 10.4 m LiDAR tree.
    const { snap } = mergeUrbanTreeGhosts({
      snap: emptySnap(),
      trees: [{ x: 20, y: 30, canopy_radius_m: 12, height_m: 10.4 }],
      transform: {
        minX: 0,
        maxY: 100,
        scale: 0.8,
        w: 100,
        h: 100,
        padPct: 5,
      },
      boardWidthM: 110,
      idn: 0,
    });
    const ghost = snap.items.find((i) => i.t === "exist" && i.ghost)!;
    expect(resolveItemHeightM(ghost)).toBe(10.4);
  });
});

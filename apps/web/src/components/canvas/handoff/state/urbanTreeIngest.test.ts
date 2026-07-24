import { describe, expect, it } from "vitest";
import { mergeUrbanTreeGhosts } from "./urbanTreeIngest";
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
});

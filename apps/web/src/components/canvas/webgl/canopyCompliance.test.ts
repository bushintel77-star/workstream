import { describe, expect, it } from "vitest";
import type { CatalogPlacement } from "@workstream/contracts";
import { buildCanopyCompliance } from "./canopyCompliance";
import type { PctPoint } from "./coordTransform";

const RING: PctPoint[] = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];

let seq = 0;
function place(over: Partial<CatalogPlacement>): CatalogPlacement {
  seq += 1;
  return {
    id: `p-${seq}`,
    symbol_id: "tree-canopy",
    x_pct: 50,
    y_pct: 50,
    rotation_deg: 0,
    scale: 1,
    ...over,
  } as CatalogPlacement;
}

describe("buildCanopyCompliance", () => {
  it("returns null without site truth (absent data → absent chip)", () => {
    expect(buildCanopyCompliance({ placements: [], boundary: [], scaleM: 100 })).toBeNull();
    expect(
      buildCanopyCompliance({ placements: [], boundary: [], scaleM: 100, lotAreaM2: 0 }),
    ).toBeNull();
  });

  it("uses the cadastral lot area when known, counting only mature trees", () => {
    const r = buildCanopyCompliance({
      placements: [
        place({ height_m: 8, canopy_radius_m: 3 }),
        place({ height_m: 9, canopy_radius_m: 2.5 }), // vicmap-style measured floor
      ],
      boundary: RING,
      scaleM: 100,
      lotAreaM2: 250, // requires 3
    });
    expect(r).not.toBeNull();
    if (!r) throw new Error("unreachable");
    expect(r.assessment.status).toBe("shortfall");
    if (r.assessment.status === "insufficient-data") throw new Error("unreachable");
    expect(r.assessment.required).toBe(3);
    expect(r.assessment.matureProvided).toBe(2);
    expect(r.assessment.shortfall).toBe(1);
    expect(r.overhangingCount).toBe(0);
  });

  it("immature catalog stock is listed with a reason (olive-standard: 5 m < 6 m)", () => {
    const r = buildCanopyCompliance({
      placements: [place({ symbol_id: "olive-standard" })],
      boundary: RING,
      scaleM: 100,
      lotAreaM2: 100, // requires 1
    });
    if (!r) throw new Error("unreachable");
    if (r.assessment.status === "insufficient-data") throw new Error("unreachable");
    expect(r.assessment.matureProvided).toBe(0);
    expect(r.assessment.immature).toHaveLength(1);
    expect(r.assessment.immature[0]!.reason).toBe("height");
  });

  it("non-tree placements are never counted", () => {
    const r = buildCanopyCompliance({
      placements: [
        place({ symbol_id: "bluestone-paving" }),
        place({ symbol_id: "lawn-instant" }),
        place({ height_m: 8, canopy_radius_m: 3 }),
      ],
      boundary: RING,
      scaleM: 100,
      lotAreaM2: 100,
    });
    if (!r) throw new Error("unreachable");
    if (r.assessment.status === "insufficient-data") throw new Error("unreachable");
    expect(r.assessment.provided).toBe(1);
    expect(r.assessment.status).toBe("compliant");
  });

  it("falls back to the boundary ring area when no cadastral area exists", () => {
    // 60 m × 60 m ring at scaleM=100 → 3 600 m² → requires 36
    const r = buildCanopyCompliance({
      placements: [],
      boundary: RING,
      scaleM: 100,
      boardAspect: 1,
    });
    if (!r) throw new Error("unreachable");
    if (r.assessment.status === "insufficient-data") throw new Error("unreachable");
    expect(r.assessment.required).toBe(36);
  });

  it("canopy crossing the title line is advisory overhang; centre outside is separate", () => {
    const r = buildCanopyCompliance({
      placements: [
        place({ x_pct: 78, y_pct: 50, height_m: 8, canopy_radius_m: 3 }), // 2 m from edge, r=3
        place({ x_pct: 50, y_pct: 50, height_m: 8, canopy_radius_m: 3 }), // 30 m from edges
        place({ x_pct: 95, y_pct: 50, height_m: 8, canopy_radius_m: 3 }), // outside the lot
      ],
      boundary: RING,
      scaleM: 100,
      lotAreaM2: 100,
    });
    if (!r) throw new Error("unreachable");
    expect(r.overhangingCount).toBe(1);
    expect(r.outsideCount).toBe(1);
  });

  it("a thin parcel measures its TRUE area under the square-board law (10 Gisborne case)", () => {
    // 80×10 board-% strip, board_width 100 m → true area 800 m² → 8 trees.
    // Under the old aspect-squash (h/w = 0.125) this would have read 100 m²
    // → 1 tree — the elongated-lot defect the square-board law fixes.
    const strip = [
      { x: 10, y: 45 },
      { x: 90, y: 45 },
      { x: 90, y: 55 },
      { x: 10, y: 55 },
    ];
    const r = buildCanopyCompliance({
      placements: [],
      boundary: strip,
      scaleM: 100,
      boardAspect: 1,
    });
    if (!r) throw new Error("unreachable");
    if (r.assessment.status === "insufficient-data") throw new Error("unreachable");
    expect(r.assessment.required).toBe(8);
  });

  it("flags a title-vs-ring area disagreement beyond LOT_AGREEMENT_FACTOR", () => {
    const strip = [
      { x: 10, y: 45 },
      { x: 90, y: 45 },
      { x: 90, y: 55 },
      { x: 10, y: 55 },
    ];
    const disagree = buildCanopyCompliance({
      placements: [],
      boundary: strip,
      scaleM: 100,
      boardAspect: 1,
      lotAreaM2: 3_000, // ring says 800 → factor 3.75 > 2
    });
    if (!disagree) throw new Error("unreachable");
    expect(disagree.areaDisagreement).toBe(true);

    const agree = buildCanopyCompliance({
      placements: [],
      boundary: strip,
      scaleM: 100,
      boardAspect: 1,
      lotAreaM2: 810, // ring 800 → factor ~1.01
    });
    if (!agree) throw new Error("unreachable");
    expect(agree.areaDisagreement).toBe(false);
  });
});

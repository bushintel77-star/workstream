import type {
  CatalogPlacement,
  CatalogSymbol,
  DesignCanvas,
  Survey,
} from "@workstream/contracts";
import { describe, expect, it } from "vitest";
import { boardContextGaps } from "./board-context";
import {
  buildStudioBoardContext,
  preferredCosting,
} from "./board-context-studio";

const PROJECT = {
  id: "11111111-1111-4111-8111-111111111111",
  address: "36 Wrights Terrace, Prahran VIC 3181",
  lat: -37.849,
  lng: 144.993,
};

const SURVEY: Survey = {
  id: "22222222-2222-4222-8222-222222222222",
  project_id: PROJECT.id,
  aerial_uri: "https://example.com/aerial.png",
  title_polygon: { type: "Polygon", coordinates: [[]] },
  house_polygon: { type: "Polygon", coordinates: [[]] },
  garden_polygon: { type: "Polygon", coordinates: [[]] },
  lot_area_m2: 500,
  house_area_m2: 200,
  garden_area_m2: 300,
  measurements: [],
};

const SQUARE = [
  { x_pct: 10, y_pct: 10 },
  { x_pct: 90, y_pct: 10 },
  { x_pct: 90, y_pct: 90 },
  { x_pct: 10, y_pct: 90 },
];

function placement(
  id: string,
  symbol_id: string,
  x_pct: number,
  y_pct: number,
  label?: string,
): CatalogPlacement {
  return { id, symbol_id, x_pct, y_pct, rotation_deg: 0, scale: 1, label };
}

function canvasOf(partial: Partial<DesignCanvas> = {}): DesignCanvas {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    project_id: PROJECT.id,
    placements: [],
    strokes: [],
    irrigation_zones: [],
    construction_trenches: [],
    annotations: [],
    features: [],
    updated_at: "2026-07-27T00:00:00.000Z",
    ...partial,
  };
}

describe("buildStudioBoardContext", () => {
  it("is deterministic regardless of the order the store returns placements", () => {
    const placements = [
      placement("a", "hornbeam-pleached", 20, 30),
      placement("b", "lomandra-mass", 60, 40),
      placement("c", "bluestone-paver", 50, 70),
    ];
    const forward = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements }),
      survey: SURVEY,
    });
    const reversed = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [...placements].reverse() }),
      survey: SURVEY,
    });
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reversed));
  });

  it("carries the planting fields the flat brief could not express", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [placement("a", "hornbeam-pleached", 20.5, 30.25)],
      }),
      survey: SURVEY,
    });
    expect(ctx.planting).toHaveLength(1);
    const row = ctx.planting[0]!;
    expect(row.species).toBe("Carpinus betulus");
    expect(row.height_m).toBe(3.5);
    // Fidelity over thrift — coordinates are not rounded away.
    expect(row.x).toBe(20.5);
    expect(row.y).toBe(30.25);
  });

  it("reads mature spread from the catalogue so canopy closure is computable", () => {
    const symbols: CatalogSymbol[] = [
      {
        id: "hornbeam-pleached",
        label: "Pleached hornbeam",
        category: "planting",
        path_d: "M0 0",
        botanical_name: "Carpinus betulus",
        mature_height_m: 8,
        default_width_m: 6.5,
        rate_card_sku: "PLT-CARP-PL24",
      },
    ];
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "hornbeam-pleached", 20, 30)] }),
      survey: SURVEY,
      symbols,
    });
    expect(ctx.planting[0]!.mature_spread_m).toBe(6.5);
    expect(ctx.planting[0]!.rate_card_sku).toBe("PLT-CARP-PL24");
    expect(ctx.planting[0]!.code).toBe("PLT-CARP-PL24");
  });

  it("routes turf to surfaces even though it is catalogued as planting", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "lawn-turf", 50, 50)] }),
      survey: SURVEY,
    });
    expect(ctx.planting).toEqual([]);
    expect(ctx.surfaces).toHaveLength(1);
    expect(ctx.surfaces[0]!.type).toBe("lawn");
    expect(ctx.surfaces[0]!.permeable).toBe(true);
    // Matches the quote quantity so design↔cost compares like with like.
    expect(ctx.surfaces[0]!.area_m2).toBe(300);
  });

  it("marks paving impermeable and groups repeat placements", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [
          placement("a", "bluestone-paver", 40, 40),
          placement("b", "bluestone-paver", 45, 45),
        ],
      }),
      survey: SURVEY,
    });
    const paving = ctx.surfaces.find((s) => s.type === "paving");
    expect(paving).toBeDefined();
    expect(paving!.permeable).toBe(false);
  });

  it("keeps drawn feature areas as measured and placement areas as derived", () => {
    const drawn = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        features: [
          {
            id: "f1",
            type: "LandscapeFeature",
            metadata: {
              layer: "hardscape",
              timestamp_created: "2026-07-27T00:00:00.000Z",
              source_attribution: "human_drawn",
              user_modification_state: "draft",
            },
            geometry: {
              type: "Polygon",
              spatial_reference: "EPSG:3857",
              canvas_origin_pct: { x_pct: 0, y_pct: 0 },
              points: [{ id: "v1", pct: { x_pct: 10, y_pct: 10 } }],
            },
            material_fill: {
              type: "surface",
              sku: "PAV-BLUE-SAWN",
              depth_m: 0.075,
              waste_allocation_pct: 10,
              live_calculations: { area_m2: 38, volume_m3: 2.85, cost_aud: 6800 },
            },
          },
        ],
      }),
      survey: SURVEY,
    });
    expect(drawn.surfaces[0]!.area_m2).toBe(38);
    expect(drawn.surfaces[0]!.permeable).toBe(false);
    expect(drawn.provenance.surfaces).toBe("operator");

    const placed = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "lawn-turf", 50, 50)] }),
      survey: SURVEY,
    });
    expect(placed.provenance.surfaces).toBe("derived");
  });

  it("holds TRP rings as overlays and only sizes them from a measured DBH", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [
          placement("a", "tree-root-protection", 30, 30),
          placement("b", "tree-root-protection", 60, 60, "exist:dbh=0.5"),
        ],
      }),
      survey: SURVEY,
    });
    expect(ctx.planting).toEqual([]);
    expect(ctx.overlays.tpz).toHaveLength(2);
    // AS 4970: R = 12 × DBH. No stamp, no radius — never assume one.
    expect(ctx.overlays.tpz[0]!.radius_m).toBeNull();
    expect(ctx.overlays.tpz[1]!.radius_m).toBeCloseTo(6, 5);
  });

  it("keeps an existing tree as planting and carries its DBH", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [placement("a", "existing-tree-retain", 55, 45, "exist:dbh=0.45")],
      }),
      survey: SURVEY,
    });
    expect(ctx.planting).toHaveLength(1);
    expect(ctx.planting[0]!.dbh_m).toBe(0.45);
  });

  it("sends lighting to systems rather than dropping it", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "brass-uplight", 25, 75)] }),
      survey: SURVEY,
    });
    expect(ctx.planting).toEqual([]);
    expect(ctx.systems.lighting_fixtures).toHaveLength(1);
  });

  it("maps spot levels from the site frame", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        site_frame: {
          boundary: SQUARE,
          building: [],
          easements: [],
          services: [],
          levels: [
            { x_pct: 20, y_pct: 30, z_m: 12.4 },
            { x_pct: 60, y_pct: 30, z_m: 11.8 },
          ],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
        },
      }),
      survey: SURVEY,
    });
    expect(ctx.geometry.levels).toHaveLength(2);
    expect(ctx.geometry.levels[0]!.rl_m).toBe(12.4);
    expect(boardContextGaps(ctx)).not.toContain("no spot levels / datum");
  });

  it("never labels traced geometry as Vicmap", () => {
    const traced = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        site_frame: {
          boundary: SQUARE,
          building: SQUARE,
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          building_source: "traced",
        },
      }),
      survey: SURVEY,
    });
    expect(traced.provenance.geometry).toBe("operator");
    expect(traced.provenance.building).toBe("operator");

    const fitted = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        site_frame: {
          boundary: SQUARE,
          building: SQUARE,
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          building_source: "vicmap",
        },
      }),
      survey: SURVEY,
    });
    expect(fitted.provenance.geometry).toBe("vicmap");
    expect(fitted.provenance.building).toBe("vicmap");
  });

  it("prefers the calibrated board scale over the caller fallback", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        site_frame: {
          boundary: SQUARE,
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          board_width_m: 42,
        },
      }),
      survey: SURVEY,
      scaleM: 110,
    });
    expect(ctx.meta.scale_m).toBe(42);
  });

  it("carries the planning flags the flat brief used to supply", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [placement("a", "tree-root-protection", 50, 50)],
      }),
      survey: SURVEY,
    });
    expect(ctx.meta.council).toBe("stonnington");
    expect(ctx.compliance.flags.some((f) => f.id === "trp-as4970")).toBe(true);
    expect(ctx.compliance.permeability_target).toBe(20);
  });

  it("reports setback state only when a boundary exists to measure against", () => {
    const noBoundary = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "bluestone-paver", 50, 50)] }),
      survey: SURVEY,
    });
    expect(noBoundary.compliance.setback_state).toBeNull();

    const withBoundary = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({
        placements: [placement("a", "bluestone-paver", 50, 50)],
        site_frame: {
          boundary: SQUARE,
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
        },
      }),
      survey: SURVEY,
    });
    expect(withBoundary.compliance.setback_state).toBe("clear");
  });

  it("uses the committed costing over the sketch estimate", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf({ placements: [placement("a", "lawn-turf", 50, 50)] }),
      survey: SURVEY,
      costing: {
        id: "44444444-4444-4444-8444-444444444444",
        design_id: "55555555-5555-4555-8555-555555555555",
        scenario: "standard",
        line_items: [
          {
            sku: "PLT-TURF",
            label: "Instant turf",
            unit: "m2",
            qty: 40,
            rate: 45,
            total: 1800,
            is_provisional: false,
          },
        ],
        subtotal: 1800,
        gst: 180,
        total: 1980,
      },
    });
    expect(ctx.commercial.quote_lines).toHaveLength(1);
    expect(ctx.commercial.total_incl_gst).toBe(1980);
    expect(ctx.provenance.commercial).toBe("derived");
  });

  it("survives an empty board and names the gaps honestly", () => {
    const ctx = buildStudioBoardContext({ project: PROJECT });
    expect(ctx.planting).toEqual([]);
    expect(ctx.geometry.boundary).toEqual([]);
    expect(ctx.commercial.quote_lines).toEqual([]);
    expect(ctx.provenance.geometry).toBe("absent");
    expect(ctx.provenance.commercial).toBe("absent");

    const gaps = boardContextGaps(ctx);
    expect(gaps).toContain("no dwelling envelope");
    expect(gaps).toContain("no planting placed");
    expect(gaps).toContain("no ground scale — metres unreliable");
  });

  it("leaves client-only studio state absent rather than inventing it", () => {
    const ctx = buildStudioBoardContext({
      project: PROJECT,
      canvas: canvasOf(),
      survey: SURVEY,
    });
    expect(ctx.climate.growth_stage).toBeNull();
    expect(ctx.climate.sun_date_preset).toBeNull();
    expect(ctx.sheet.paper).toBeNull();
    expect(ctx.geometry.datum_m).toBeNull();
    expect(ctx.meta.pfi).toBeNull();
  });

  it("reads coverage only when the dwelling outline is real", () => {
    const withHouse = buildStudioBoardContext({
      project: PROJECT,
      survey: SURVEY,
    });
    expect(withHouse.geometry.coverage_pct).toBe(40);

    const noHouse = buildStudioBoardContext({
      project: PROJECT,
      survey: { ...SURVEY, house_area_m2: 0 },
    });
    expect(noHouse.geometry.coverage_pct).toBeNull();
  });
});

describe("preferredCosting", () => {
  it("prefers the standard scenario", () => {
    const lean = { scenario: "lean" } as never;
    const standard = { scenario: "standard" } as never;
    expect(preferredCosting([lean, standard])).toBe(standard);
  });

  it("returns null with nothing costed", () => {
    expect(preferredCosting([])).toBeNull();
  });
});

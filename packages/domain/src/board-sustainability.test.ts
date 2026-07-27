import { describe, expect, it } from "vitest";
import { buildBoardContext, type BoardContextInput } from "./board-context";
import {
  buildBoardSustainability,
  formatBoardSustainabilityForAi,
  type BoardSustainabilityMetric,
} from "./board-sustainability";

/** Board is 40 m across 100% width, so 1 m = 2.5%. */
const SCALE_M = 40;

function ctxOf(input: BoardContextInput) {
  return buildBoardContext({
    ...input,
    meta: { project_id: "p1", scale_m: SCALE_M, ...input.meta },
  });
}

function metric(
  ctx: ReturnType<typeof ctxOf>,
  id: string,
): BoardSustainabilityMetric {
  const hit = buildBoardSustainability(ctx).metrics.find((m) => m.id === id);
  expect(hit, `metric ${id}`).toBeDefined();
  return hit!;
}

describe("permeable area", () => {
  it("reads sealed surface against the outdoor area and the benchmark", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 300 },
      surfaces: [
        { type: "paving", area_m2: 90, material: "Bluestone paving", permeable: false },
      ],
      compliance: { permeability_target: 20 },
    });
    const m = metric(ctx, "permeable-area");
    expect(m.value).toBe(70);
    expect(m.target).toBe(20);
    expect(m.status).toBe("on_track");
    expect(m.statement).toContain("Bluestone paving");
  });

  it("reports short when the sealed run overruns the benchmark", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 100 },
      surfaces: [
        { type: "paving", area_m2: 90, material: "Bluestone paving", permeable: false },
      ],
      compliance: { permeability_target: 20 },
    });
    expect(metric(ctx, "permeable-area").status).toBe("short");
  });

  it("is absent — not 100% — when nothing has been measured", () => {
    const ctx = ctxOf({ geometry: { outdoor_m2: 300 } });
    const m = metric(ctx, "permeable-area");
    expect(m.status).toBe("absent");
    expect(m.value).toBeNull();
    expect(m.statement).toContain("No sealed surface measured");
  });
});

describe("canopy at maturity", () => {
  it("projects mature crowns over the outdoor area", () => {
    // Two 8 m crowns: 2 × π × 4² ≈ 100.5 m² over 300 m² ≈ 33.5%.
    const ctx = ctxOf({
      geometry: { outdoor_m2: 300 },
      planting: [
        { code: "B01", x: 10, y: 10, mature_spread_m: 8 },
        { code: "B02", x: 60, y: 60, mature_spread_m: 8 },
      ],
      compliance: { canopy_target: 15 },
    });
    const m = metric(ctx, "canopy-cover");
    expect(m.value).toBeCloseTo(33.5, 1);
    expect(m.status).toBe("on_track");
    expect(m.sdg).toContain(11);
  });

  it("is absent when no planting carries a mature spread", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 300 },
      planting: [{ code: "B01", x: 10, y: 10 }],
    });
    const m = metric(ctx, "canopy-cover");
    expect(m.status).toBe("absent");
    expect(m.statement).toContain("unknown, not zero");
  });
});

describe("irrigation peak draw", () => {
  /** 40% of board width = 16 m of drip run. */
  const DRIP_RUN = [
    { x_pct: 10, y_pct: 50 },
    { x_pct: 50, y_pct: 50 },
  ];

  it("counts emitters along the drawn run at the zone's own flow", () => {
    const ctx = ctxOf({
      systems: {
        irrigation_zones: [
          {
            id: "z1",
            name: "Front beds",
            kind: "drip",
            points: DRIP_RUN,
            emitter_spacing_cm: 40,
            emitter_flow_lph: 2,
          },
        ],
      },
    });
    // 16 m ÷ 0.4 m = 40 emitters × 2 L/h.
    const m = metric(ctx, "irrigation-demand");
    expect(m.value).toBe(80);
    expect(m.status).toBe("measured");
    expect(m.model).toContain("Peak simultaneous draw");
    expect(m.statement).toContain("Front beds");
  });

  it("ignores lighting conduit runs — they put no water on the ground", () => {
    const ctx = ctxOf({
      systems: {
        irrigation_zones: [
          { id: "z1", name: "Path lights", kind: "lighting", points: DRIP_RUN },
        ],
      },
    });
    expect(metric(ctx, "irrigation-demand").status).toBe("absent");
  });

  it("will not convert runs to metres without a ground scale", () => {
    const ctx = ctxOf({
      meta: { project_id: "p1", scale_m: null },
      systems: {
        irrigation_zones: [
          { id: "z1", name: "Front beds", kind: "drip", points: DRIP_RUN },
        ],
      },
    });
    const m = metric(ctx, "irrigation-demand");
    expect(m.status).toBe("absent");
    expect(m.statement).toContain("No ground scale");
  });
});

describe("carbon held in canopy", () => {
  it("names the coefficient it applied so the figure can be checked", () => {
    const ctx = ctxOf({
      planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 8 }],
    });
    const m = metric(ctx, "canopy-carbon");
    // π × 4² ≈ 50.3 m² × 8 kg.
    expect(m.value).toBe(402);
    expect(m.model).toContain("8 kg");
    expect(m.model).toContain("not carbon accounting");
  });
});

describe("open space and fall", () => {
  it("reads unbuilt share from measured coverage", () => {
    const ctx = ctxOf({ geometry: { lot_m2: 500, coverage_pct: 40 } });
    const m = metric(ctx, "open-space");
    expect(m.value).toBe(60);
    expect(m.statement).toContain("500 m² lot");
  });

  it("reads fall across authored spot levels", () => {
    const ctx = ctxOf({
      geometry: {
        levels: [
          { rl_m: 12.4, x: 10, y: 10 },
          { rl_m: 11.15, x: 80, y: 80 },
        ],
      },
    });
    const m = metric(ctx, "site-fall");
    expect(m.value).toBe(1.3);
    expect(m.statement).toContain("1.25 m");
  });

  it("calls a near-level site flat rather than graded", () => {
    const ctx = ctxOf({
      geometry: {
        levels: [
          { rl_m: 12.0, x: 10, y: 10 },
          { rl_m: 12.05, x: 80, y: 80 },
        ],
      },
    });
    expect(metric(ctx, "site-fall").statement).toContain("effectively flat");
  });

  it("says fall is unreadable rather than zero on a board with no levels", () => {
    const ctx = ctxOf({ geometry: { outdoor_m2: 300 } });
    const m = metric(ctx, "site-fall");
    expect(m.status).toBe("absent");
    expect(m.value).toBeNull();
  });
});

describe("the read-out as a whole", () => {
  it("assesses every metric and counts only the measurable ones", () => {
    const empty = buildBoardSustainability(ctxOf({}));
    expect(empty.assessed).toBe(6);
    expect(empty.measured).toBe(0);
    expect(empty.metrics.every((m) => m.status === "absent")).toBe(true);
  });

  it("carries a SITES credit and at least one SDG on every metric", () => {
    const s = buildBoardSustainability(
      ctxOf({
        geometry: { outdoor_m2: 300, lot_m2: 500, coverage_pct: 40 },
        planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 8 }],
      }),
    );
    for (const m of s.metrics) {
      expect(m.sites_credit.length).toBeGreaterThan(0);
      expect(m.sdg.length).toBeGreaterThan(0);
      expect(m.cites.length).toBeGreaterThan(0);
    }
  });

  it("weights a metric by the weakest block behind it", () => {
    const ctx = ctxOf({
      geometry: { outdoor_m2: 300 },
      surfaces: [{ type: "paving", area_m2: 90, permeable: false }],
      compliance: { permeability_target: 20 },
      provenance: { surfaces: "derived", geometry: "vicmap" },
    });
    expect(metric(ctx, "permeable-area").basis).toBe("derived");
  });

  it("is deterministic — the same board yields the same read-out", () => {
    const input: BoardContextInput = {
      geometry: { outdoor_m2: 300 },
      planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 8 }],
    };
    expect(JSON.stringify(buildBoardSustainability(ctxOf(input)))).toBe(
      JSON.stringify(buildBoardSustainability(ctxOf(input))),
    );
  });

  it("never presents an absent metric as a zero in the AI block", () => {
    const block = formatBoardSustainabilityForAi(
      buildBoardSustainability(ctxOf({})),
    );
    expect(block).toContain("0 of 6 metrics measurable");
    expect(block).toContain("not measured");
    expect(block).not.toMatch(/: 0 /);
  });
});

import { describe, expect, it } from "vitest";
import { buildBoardContext, type BoardContextInput } from "./board-context";
import {
  buildBoardDisclaimers,
  formatBoardDisclaimersForAi,
  type BoardDisclaimer,
  type BoardDisclaimerKind,
} from "./board-liability";

/** Board is 40 m across 100% width, so 1 m = 2.5%. */
const SCALE_M = 40;

const LOT = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

function ctxOf(input: BoardContextInput) {
  return buildBoardContext({
    ...input,
    meta: { project_id: "p1", scale_m: SCALE_M, ...input.meta },
  });
}

function of(
  ctx: ReturnType<typeof ctxOf>,
  kind: BoardDisclaimerKind,
): BoardDisclaimer | undefined {
  return buildBoardDisclaimers(ctx).find((d) => d.kind === kind);
}

describe("nothing to disclaim", () => {
  it("stays silent on an empty board", () => {
    expect(buildBoardDisclaimers(ctxOf({}))).toEqual([]);
  });
});

describe("maturity watermark", () => {
  it("fires on planting drawn at mature spread and names the widest crown", () => {
    const ctx = ctxOf({
      planting: [
        { code: "B01", x: 10, y: 10, mature_spread_m: 6 },
        { code: "B02", x: 40, y: 40, mature_spread_m: 9 },
      ],
    });
    const d = of(ctx, "maturity");
    expect(d).toBeDefined();
    expect(d!.required).toBe(true);
    expect(d!.statement).toContain("9 m across");
    expect(d!.statement).toContain("not the appearance at handover");
    expect(d!.trigger).toContain("2 planting placements");
  });

  it("names the growth stage the board was drawn at when one is set", () => {
    const ctx = ctxOf({
      planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 6 }],
      climate: { growth_stage: "Year 10" },
    });
    expect(of(ctx, "maturity")!.statement).toContain("(Year 10)");
  });

  it("stays silent when no planting carries a mature spread", () => {
    const ctx = ctxOf({ planting: [{ code: "B01", x: 10, y: 10 }] });
    expect(of(ctx, "maturity")).toBeUndefined();
  });
});

describe("design intent", () => {
  it("fires on any drawn board and is always required", () => {
    const ctx = ctxOf({ geometry: { boundary: LOT } });
    const d = of(ctx, "design_intent");
    expect(d!.required).toBe(true);
    expect(d!.statement).toContain("verified on site");
  });

  it("says so plainly when no ground scale has been established", () => {
    const ctx = ctxOf({
      meta: { project_id: "p1", scale_m: null },
      geometry: { boundary: LOT },
    });
    const d = of(ctx, "design_intent");
    expect(d!.statement).toContain("no ground scale has been established");
    expect(d!.trigger).toContain("no ground scale");
  });
});

describe("subsurface", () => {
  it("fires on drawn trenches and escalates when nothing has been located", () => {
    const ctx = ctxOf({
      systems: {
        trenches: [
          {
            id: "t1",
            kind: "drainage",
            points: [
              { x: 10, y: 50 },
              { x: 80, y: 50 },
            ],
          },
        ],
      },
    });
    const d = of(ctx, "subsurface");
    expect(d!.required).toBe(true);
    expect(d!.statement).toContain("Before You Dig Australia");
    expect(d!.statement).toContain("No located asset has been recorded");
    expect(d!.trigger).toContain("1 trench run");
  });

  it("drops the escalation once an asset is located", () => {
    const ctx = ctxOf({
      systems: {
        trenches: [
          { id: "t1", points: [{ x: 10, y: 50 }, { x: 80, y: 50 }] },
        ],
        byda_assets: [{ id: "b1", kind: "gas" }],
      },
    });
    const d = of(ctx, "subsurface");
    expect(d!.statement).not.toContain("No located asset has been recorded");
    expect(d!.trigger).toContain("1 located asset");
  });

  it("fires on excavating surfaces with no trench drawn at all", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "exist", material: "Retaining wall", permeable: null }],
    });
    expect(of(ctx, "subsurface")!.trigger).toContain("Retaining wall");
  });

  it("stays silent on a board with nothing that digs", () => {
    const ctx = ctxOf({
      planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 6 }],
    });
    expect(of(ctx, "subsurface")).toBeUndefined();
  });
});

describe("tree protection", () => {
  it("is required when a protection zone is drawn", () => {
    const ctx = ctxOf({ overlays: { tpz: [{ code: "TRP-TPZ", radius_m: 5, x: 70, y: 30 }] } });
    const d = of(ctx, "tpo");
    expect(d!.required).toBe(true);
    expect(d!.statement).toContain("client's responsibility");
    expect(d!.statement).toContain("AS 4970");
    expect(d!.trigger).toContain("1 protection zone drawn");
  });

  it("is required when an existing trunk has been measured", () => {
    const ctx = ctxOf({
      planting: [{ code: "EXISTING TREE RETAIN", x: 70, y: 30, dbh_m: 0.45 }],
    });
    const d = of(ctx, "tpo");
    expect(d!.required).toBe(true);
    expect(d!.trigger).toContain("1 existing tree with a measured trunk");
  });

  it("is advisory when only the planning flag fired", () => {
    const ctx = ctxOf({
      compliance: {
        flags: [{ id: "trp-as4970", severity: "review", statement: "New trees near dwelling" }],
      },
    });
    const d = of(ctx, "tpo");
    expect(d).toBeDefined();
    expect(d!.required).toBe(false);
  });

  it("folds a recorded heritage overlay into the notice", () => {
    const ctx = ctxOf({
      overlays: {
        tpz: [{ code: "TRP-TPZ", radius_m: 5, x: 70, y: 30 }],
        keyless: [{ kind: "heritage", label: "HO123" }],
      },
    });
    expect(of(ctx, "tpo")!.statement).toContain("heritage overlay");
  });

  it("stays silent when no tree is protected or measured", () => {
    const ctx = ctxOf({
      planting: [{ code: "B01", x: 10, y: 10, mature_spread_m: 6 }],
    });
    expect(of(ctx, "tpo")).toBeUndefined();
  });
});

describe("safety waiver", () => {
  it("is required when a pool is drawn with no barrier anywhere on the board", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "canopy", material: "Pool", permeable: null }],
    });
    const d = of(ctx, "safety_waiver");
    expect(d!.required).toBe(true);
    expect(d!.statement).toContain("No compliant barrier is drawn");
    expect(d!.statement).toContain("AS 1926");
    expect(d!.trigger).toContain("no barrier drawn on the board");
  });

  it("drops to advisory once a barrier is on the board", () => {
    const ctx = ctxOf({
      surfaces: [
        { type: "canopy", material: "Pool", permeable: null },
        { type: "canopy", material: "Pool fence", permeable: null },
      ],
    });
    const d = of(ctx, "safety_waiver");
    expect(d!.required).toBe(false);
    expect(d!.statement).not.toContain("No compliant barrier is drawn");
    expect(d!.statement).toContain("Notice of Disclaimer");
  });

  it("fires on retaining with no pool at all", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "exist", material: "Retaining wall", permeable: null }],
    });
    const d = of(ctx, "safety_waiver");
    expect(d).toBeDefined();
    expect(d!.required).toBe(false);
    expect(d!.trigger).toContain("Retaining wall");
  });

  it("stays silent on a board with no fall hazard and no structural flag", () => {
    const ctx = ctxOf({
      surfaces: [{ type: "lawn", material: "Turf", permeable: true }],
    });
    expect(of(ctx, "safety_waiver")).toBeUndefined();
  });
});

describe("the overlay as a whole", () => {
  const BUSY: BoardContextInput = {
    geometry: { boundary: LOT, outdoor_m2: 300 },
    planting: [
      { code: "B01", x: 10, y: 10, mature_spread_m: 8 },
      { code: "EXISTING TREE RETAIN", x: 70, y: 30, dbh_m: 0.45 },
    ],
    surfaces: [{ type: "canopy", material: "Pool", permeable: null }],
    systems: {
      trenches: [{ id: "t1", points: [{ x: 10, y: 50 }, { x: 80, y: 50 }] }],
    },
  };

  it("puts the required notices ahead of the advisory ones", () => {
    const all = buildBoardDisclaimers(ctxOf(BUSY));
    const firstAdvisory = all.findIndex((d) => !d.required);
    if (firstAdvisory >= 0) {
      expect(all.slice(firstAdvisory).every((d) => !d.required)).toBe(true);
    }
    expect(all.map((d) => d.kind).sort()).toEqual(
      ["design_intent", "maturity", "safety_waiver", "subsurface", "tpo"].sort(),
    );
  });

  it("cites artefacts and a basis on every notice", () => {
    for (const d of buildBoardDisclaimers(ctxOf(BUSY))) {
      expect(d.cites.length).toBeGreaterThan(0);
      expect(d.trigger.length).toBeGreaterThan(0);
      expect(d.basis).toBeTruthy();
    }
  });

  it("weights a notice by the weakest block behind it", () => {
    const ctx = ctxOf({
      ...BUSY,
      provenance: { systems: "seed", surfaces: "operator" },
    });
    expect(of(ctx, "subsurface")!.basis).toBe("seed");
  });

  it("is deterministic — the same board yields the same notices", () => {
    expect(JSON.stringify(buildBoardDisclaimers(ctxOf(BUSY)))).toBe(
      JSON.stringify(buildBoardDisclaimers(ctxOf(BUSY))),
    );
  });

  it("marks required and advisory apart in the AI block", () => {
    const block = formatBoardDisclaimersForAi(buildBoardDisclaimers(ctxOf(BUSY)));
    expect(block).toContain("[REQUIRED]");
    expect(block).toContain("you never issue it");
    expect(formatBoardDisclaimersForAi([])).toContain("none");
  });
});

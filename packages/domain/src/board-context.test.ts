import { describe, expect, it } from "vitest";
import {
  BOARD_CONTEXT_VERSION,
  boardContextGaps,
  buildBoardContext,
} from "./board-context";

const SQUARE = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

describe("buildBoardContext", () => {
  it("stamps the contract version", () => {
    const ctx = buildBoardContext({ meta: { project_id: "p1" } });
    expect(ctx.version).toBe(BOARD_CONTEXT_VERSION);
  });

  it("is deterministic — same board in, byte-identical JSON out", () => {
    const input = {
      meta: { project_id: "p1", address: "12 Wrights Terrace", scale_m: 110 },
      geometry: { boundary: SQUARE, lot_m2: 185 },
      planting: [
        { code: "B14", species: "Lomandra", count: 12 },
        { code: "B02", species: "Hornbeam", count: 3 },
      ],
    };
    expect(JSON.stringify(buildBoardContext(input))).toBe(
      JSON.stringify(buildBoardContext(input)),
    );
  });

  it("sorts planting by code so placement order cannot leak in", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1" },
      planting: [
        { code: "B14" },
        { code: "B02" },
        { code: "B07" },
      ],
    });
    expect(ctx.planting.map((p) => p.code)).toEqual(["B02", "B07", "B14"]);
  });

  it("keeps full coordinate precision (fidelity over thrift)", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1" },
      geometry: { boundary: [{ x: 10.123456, y: 20.654321 }, ...SQUARE] },
    });
    expect(ctx.geometry.boundary[0]).toEqual({ x: 10.123456, y: 20.654321 });
  });

  it("carries the fields that unlock consequence reasoning", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1", scale_m: 110 },
      planting: [
        {
          code: "B14",
          species: "Carpinus betulus",
          mature_spread_m: 6.5,
          height_m: 8,
          dbh_m: 0.3,
          growth_stage_now: "young",
        },
      ],
      geometry: { levels: [{ rl_m: 12.4, x: 20, y: 30 }], datum_m: 10 },
      commercial: {
        quote_lines: [{ label: "Instant turf", qty: 40, unit: "m2", total: 1800 }],
        total_incl_gst: 1980,
      },
      surfaces: [{ type: "turf", area_m2: 40, permeable: true }],
    });
    expect(ctx.planting[0]!.mature_spread_m).toBe(6.5);
    expect(ctx.geometry.levels[0]!.rl_m).toBe(12.4);
    expect(ctx.commercial.quote_lines[0]!.label).toBe("Instant turf");
    expect(ctx.surfaces[0]!.permeable).toBe(true);
  });

  it("marks provenance so the model can weight what it reads", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1" },
      geometry: { boundary: SQUARE },
      planting: [{ code: "B01" }],
    });
    expect(ctx.provenance.geometry).toBe("operator");
    expect(ctx.provenance.planting).toBe("operator");
    expect(ctx.provenance.building).toBe("absent");
  });

  it("lets callers override provenance (seed vs vicmap)", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1" },
      geometry: { boundary: SQUARE },
      provenance: { geometry: "seed" },
    });
    expect(ctx.provenance.geometry).toBe("seed");
  });

  it("survives an empty board without throwing", () => {
    const ctx = buildBoardContext({ meta: { project_id: "p1" } });
    expect(ctx.geometry.boundary).toEqual([]);
    expect(ctx.planting).toEqual([]);
    expect(ctx.commercial.quote_lines).toEqual([]);
  });

  it("drops malformed points rather than emitting NaN", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1" },
      geometry: {
        boundary: [
          { x: 1, y: 2 },
          { x: Number.NaN, y: 5 },
          null,
        ] as never,
      },
    });
    expect(ctx.geometry.boundary).toEqual([{ x: 1, y: 2 }]);
  });
});

describe("boardContextGaps", () => {
  it("names absent blocks so the assist stays honest", () => {
    const ctx = buildBoardContext({ meta: { project_id: "p1" } });
    const gaps = boardContextGaps(ctx);
    expect(gaps).toContain("no dwelling envelope");
    expect(gaps).toContain("no spot levels / datum");
    expect(gaps).toContain("no ground scale — metres unreliable");
  });

  it("reports no gaps for the blocks that are present", () => {
    const ctx = buildBoardContext({
      meta: { project_id: "p1", scale_m: 110 },
      geometry: {
        boundary: SQUARE,
        building: SQUARE,
        levels: [{ rl_m: 10, x: 1, y: 1 }],
      },
      planting: [{ code: "B01" }],
      surfaces: [{ type: "turf", area_m2: 20 }],
      systems: { services: [SQUARE] },
      commercial: { quote_lines: [{ label: "x", qty: 1, unit: "ea", total: 10 }] },
    });
    expect(boardContextGaps(ctx)).toEqual([]);
  });
});

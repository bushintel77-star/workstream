import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BOARD_PCT_MAX,
  BOARD_PCT_MIN,
  BoardPctSchema,
  BoardPointPctFromUnboundedSchema,
  BoardPointPctSchema,
  clampBoardPct,
  MAX_STROKE_SHAPE_POINTS,
  MAX_SUGGESTION_OUTLINE_POINTS,
  toBoardPoint,
  toBoardPoints,
} from "./board-coords";
import { LandscapeFeatureSchema } from "./landscape-feature";
import { CanvasStrokeSchema, SketchCadSuggestionSchema } from "./catalog";

/**
 * The seeded reproduction of the 2026-08-22 autosave outage: a sketch stroke
 * drawn off the board on both axes. Sketch strokes are legitimately unbounded;
 * feature vertices are not.
 */
const OFF_BOARD_INK = [
  { x_pct: -195, y_pct: -12.5 },
  { x_pct: 42.5, y_pct: 61.25 },
  { x_pct: 172, y_pct: 168.04 },
];

describe("board coordinate bound", () => {
  it("lands out-of-range scalars on the nearest edge", () => {
    expect(clampBoardPct(-195)).toBe(BOARD_PCT_MIN);
    expect(clampBoardPct(172)).toBe(BOARD_PCT_MAX);
    expect(clampBoardPct(42.5)).toBe(42.5);
    expect(clampBoardPct(BOARD_PCT_MIN)).toBe(BOARD_PCT_MIN);
    expect(clampBoardPct(BOARD_PCT_MAX)).toBe(BOARD_PCT_MAX);
  });

  it("collapses non-finite input to the origin edge rather than propagating NaN", () => {
    expect(clampBoardPct(Number.NaN)).toBe(BOARD_PCT_MIN);
    expect(clampBoardPct(Number.POSITIVE_INFINITY)).toBe(BOARD_PCT_MAX);
    expect(clampBoardPct(Number.NEGATIVE_INFINITY)).toBe(BOARD_PCT_MIN);
    // NaN is what a bare Math.max(0, Math.min(100, NaN)) would have returned,
    // and it fails BoardPctSchema — i.e. it only defers the same rejection.
    expect(BoardPctSchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("keeps the read side strict — an out-of-range point is rejected, not snapped", () => {
    expect(BoardPointPctSchema.safeParse({ x_pct: -195, y_pct: 5 }).success).toBe(
      false,
    );
    expect(BoardPointPctSchema.safeParse({ x_pct: 5, y_pct: 172 }).success).toBe(
      false,
    );
    expect(
      BoardPointPctSchema.safeParse({ x_pct: 42.5, y_pct: 61.25 }).success,
    ).toBe(true);
  });

  it("normalises unbounded writer input deterministically", () => {
    const landed = OFF_BOARD_INK.map((p) =>
      BoardPointPctFromUnboundedSchema.parse(p),
    );
    expect(landed).toEqual([
      { x_pct: 0, y_pct: 0 },
      { x_pct: 42.5, y_pct: 61.25 },
      { x_pct: 100, y_pct: 100 },
    ]);
    // Deterministic: same input, same output, no clamping drift.
    expect(
      OFF_BOARD_INK.map((p) => BoardPointPctFromUnboundedSchema.parse(p)),
    ).toEqual(landed);
    expect(toBoardPoints(OFF_BOARD_INK)).toEqual(landed);
  });

  /*
   * NEGATIVE CONTROL.
   *
   * The assertion above passes because the primitive lands the point, not
   * because the fixture happened to be in range. This rebuilds the exact same
   * parse pipeline with the primitive removed (identity in place of
   * `toBoardPoint`) and asserts it rejects the identical input.
   *
   * If `clampBoardPct` / `toBoardPoint` were ever weakened to a pass-through,
   * the real pipeline would behave like this control and the test above would
   * fail. That is the property the outage lacked: every test that exercised a
   * writer used in-range fixtures, so none of them could tell whether the
   * writer clamped.
   */
  it("negative control: the same pipeline without the primitive rejects the same input", () => {
    const withoutPrimitive = z
      .object({ x_pct: z.number(), y_pct: z.number() })
      .transform((p) => p)
      .pipe(BoardPointPctSchema);

    for (const p of OFF_BOARD_INK) {
      const real = BoardPointPctFromUnboundedSchema.safeParse(p);
      const control = withoutPrimitive.safeParse(p);
      expect(real.success).toBe(true);
      if (p.x_pct < BOARD_PCT_MIN || p.x_pct > BOARD_PCT_MAX) {
        expect(control.success).toBe(false);
      }
    }

    // And the specific error the outage surfaced in production.
    const control = withoutPrimitive.safeParse(OFF_BOARD_INK[0]!);
    expect(control.success).toBe(false);
    if (!control.success) {
      expect(control.error.issues[0]?.message).toContain(
        "greater than or equal to 0",
      );
    }
  });

  it("is the bound the persisted feature geometry actually enforces", () => {
    const feature = (pct: { x_pct: number; y_pct: number }) => ({
      id: "f1",
      type: "LandscapeFeature" as const,
      metadata: {
        layer: "hardscape" as const,
        timestamp_created: "2026-08-22T00:00:00.000Z",
        source_attribution: "human_drawn" as const,
        user_modification_state: "draft" as const,
      },
      geometry: {
        type: "LineString" as const,
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: [{ id: "f1-v0", pct }],
      },
    });

    // Raw off-board ink is what took autosave down.
    expect(LandscapeFeatureSchema.safeParse(feature(OFF_BOARD_INK[0]!)).success)
      .toBe(false);
    // The same ink, landed by the primitive, is accepted.
    expect(
      LandscapeFeatureSchema.safeParse(feature(toBoardPoint(OFF_BOARD_INK[0]!)))
        .success,
    ).toBe(true);
  });

  it("exports the caps the geometry schemas enforce", () => {
    const stroke = (n: number) => ({
      id: "11111111-1111-4111-8111-111111111111",
      tool: "pen",
      color: "#000000",
      width: 2,
      points: [
        { x_pct: 0, y_pct: 0 },
        { x_pct: 1, y_pct: 1 },
      ],
      shape_points: Array.from({ length: n }, () => ({ x_pct: 1, y_pct: 1 })),
    });
    expect(CanvasStrokeSchema.safeParse(stroke(MAX_STROKE_SHAPE_POINTS)).success)
      .toBe(true);
    expect(
      CanvasStrokeSchema.safeParse(stroke(MAX_STROKE_SHAPE_POINTS + 1)).success,
    ).toBe(false);

    const suggestion = (n: number) => ({
      id: "s1",
      symbol_id: "bluestone-paver",
      x_pct: 10,
      y_pct: 10,
      confidence: 0.8,
      reason: "test",
      outline_pct: Array.from({ length: n }, () => ({ x_pct: 1, y_pct: 1 })),
    });
    expect(
      SketchCadSuggestionSchema.safeParse(
        suggestion(MAX_SUGGESTION_OUTLINE_POINTS),
      ).success,
    ).toBe(true);
    expect(
      SketchCadSuggestionSchema.safeParse(
        suggestion(MAX_SUGGESTION_OUTLINE_POINTS + 1),
      ).success,
    ).toBe(false);
  });
});

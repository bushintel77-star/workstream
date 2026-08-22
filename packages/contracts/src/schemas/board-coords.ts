import { z } from "zod";

/**
 * The board is the design surface every *sited* artifact is positioned on: a
 * percent space whose axes both run 0-100. Feature vertices, site-frame points
 * and scatter instances are all bounded to it.
 *
 * Ink is deliberately NOT bounded to it — an operator may draw past the board
 * edge onto the context ground, so `CanvasPointPctSchema` (catalog) stays
 * unbounded. That asymmetry is the hazard this module exists to close: every
 * writer that turns unbounded source geometry into a bounded artifact has to
 * land it on the board first, and until now each one re-implemented that
 * landing by hand — ten copies of `clampPct` across 25 files. The first writer
 * to omit it (`buildLandscapeFeatureFromStroke`, 2026-08-22) took autosave down
 * with `Number must be greater than or equal to 0`.
 *
 * The bound is declared here exactly once, and so is the operation that
 * satisfies it. A writer that needs the bound imports it; it no longer has the
 * option of spelling `Math.max(0, Math.min(100, v))` and getting it subtly
 * wrong, or of forgetting the bound exists.
 */
export const BOARD_PCT_MIN = 0;
export const BOARD_PCT_MAX = 100;

/** A scalar on a board axis. The single declaration of the bound. */
export const BoardPctSchema = z
  .number()
  .min(BOARD_PCT_MIN)
  .max(BOARD_PCT_MAX);

/**
 * Land a scalar on the board.
 *
 * Infinities land on the edge they ran off, exactly as the hand-rolled
 * `Math.max(0, Math.min(100, v))` copies did — an infinite coordinate is still
 * a direction. NaN is not: it has no board position at all, so it collapses to
 * the origin edge. The hand-rolled copies returned NaN there, which only defers
 * the same rejection to whichever schema parses the document next.
 */
export function clampBoardPct(value: number): number {
  if (Number.isNaN(value)) return BOARD_PCT_MIN;
  if (value < BOARD_PCT_MIN) return BOARD_PCT_MIN;
  if (value > BOARD_PCT_MAX) return BOARD_PCT_MAX;
  return value;
}

/**
 * A point that is on the board, by contract.
 *
 * Strict on purpose: it rejects out-of-range input rather than snapping it.
 * Clamping here would also clamp on *read*, which turns a broken upstream
 * (say a coordinate transform that starts emitting 5000) into features silently
 * pinned to the board edge, with the original value gone. The 400 this schema
 * raised on 2026-08-22 is what surfaced the bug the same day; a normalising
 * read would have buried it. Writers that legitimately start from unbounded
 * geometry use `BoardPointPctFromUnboundedSchema` or `toBoardPoint` instead.
 */
export const BoardPointPctSchema = z.object({
  x_pct: BoardPctSchema,
  y_pct: BoardPctSchema,
});
export type BoardPointPct = z.infer<typeof BoardPointPctSchema>;

/** Land an arbitrary point on the board. */
export function toBoardPoint(point: {
  x_pct: number;
  y_pct: number;
}): BoardPointPct {
  return {
    x_pct: clampBoardPct(point.x_pct),
    y_pct: clampBoardPct(point.y_pct),
  };
}

/** Land a run of arbitrary points on the board, order preserved. */
export function toBoardPoints(
  points: ReadonlyArray<{ x_pct: number; y_pct: number }>,
): BoardPointPct[] {
  return points.map(toBoardPoint);
}

/**
 * The writer-side parser: takes geometry from an unbounded source and emits a
 * point that is on the board.
 *
 * The `.pipe()` back into the strict schema is the load-bearing part. It makes
 * the normalisation *provable* rather than assumed — if `toBoardPoint` were
 * deleted, weakened, or given a bound that disagreed with `BoardPctSchema`, the
 * pipe would reject and the failure would surface here, at the boundary that
 * declares the bound, instead of at some caller's autosave in production.
 */
export const BoardPointPctFromUnboundedSchema = z
  .object({ x_pct: z.number(), y_pct: z.number() })
  .transform(toBoardPoint)
  .pipe(BoardPointPctSchema);

/**
 * Vertex caps for the board geometry that carries them. They live beside the
 * bound because they are the same kind of fact — a limit the schema declares
 * that a writer has to satisfy — and because a cap duplicated as a bare literal
 * in a writer is the same defect as a bound duplicated as a bare literal.
 */
export const MAX_STROKE_SHAPE_POINTS = 256;
export const MAX_SUGGESTION_OUTLINE_POINTS = 64;

/**
 * Screen-px declutter for on-plan schedule cards (Title / Dwelling / Outdoor).
 * Cards never share a projected point — stack a constant screen offset when
 * bboxes would overlap, independent of zoom / rotation. Also stay clear of
 * the right data lane (`safeRightPx`) so panels and cards cannot pile up.
 */

export type ScheduleCardSeed = {
  id: string;
  /** Projected screen position (client / board-local px). */
  x: number;
  y: number;
};

export type ScheduleCardPlacement = {
  id: string;
  /** Extra X/Y offset in screen px (after translate(-50%, -50%)). */
  offsetX: number;
  offsetY: number;
};

/**
 * Approximate card footprint for collision (screen px). The Title card grows
 * to three lines when Vicmap parcel metadata is present (key / area / PFI),
 * so the collision box and the stack step must cover that tallest variant —
 * a 48/56 assumption let stacked cards overlap (lane-law e2e).
 */
export const SCHEDULE_CARD_W = 150;
export const SCHEDULE_CARD_H = 68;
/** Vertical stack step when two cards would share a point / collide. */
export const SCHEDULE_CARD_STACK_PX = SCHEDULE_CARD_H + 8;

function overlaps(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return (
    Math.abs(ax - bx) < SCHEDULE_CARD_W &&
    Math.abs(ay - by) < SCHEDULE_CARD_H
  );
}

export type PlaceScheduleOpts = {
  /** Board / viewport width in CSS px. */
  viewportW: number;
  /** Reserved right inset (matches `--ws-safe-right` when a panel is open). */
  safeRightPx: number;
};

/**
 * Place cards in input order. Later cards that collide with earlier ones
 * step down by SCHEDULE_CARD_STACK_PX until clear (capped). Then nudge left
 * so the card centre stays clear of the right data lane.
 */
export function placeScheduleCards(
  cards: ScheduleCardSeed[],
  opts?: PlaceScheduleOpts,
): ScheduleCardPlacement[] {
  const placed: Array<ScheduleCardSeed & { offsetX: number; offsetY: number }> =
    [];
  const maxCenterX = opts
    ? opts.viewportW - opts.safeRightPx - SCHEDULE_CARD_W / 2 - 8
    : Number.POSITIVE_INFINITY;

  for (const card of cards) {
    /*
     * Clamp into the lane-safe area FIRST, then collide on the clamped
     * centre. Clamping after collision let two cards that both get pushed
     * to the lane edge (e.g. shared centroid beyond the lane at zoom-out)
     * pass the overlap check unclamped, then land on the same point.
     */
    const offsetX = Number.isFinite(maxCenterX) && card.x > maxCenterX
      ? maxCenterX - card.x
      : 0;
    const cx = card.x + offsetX;
    let offsetY = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const cy = card.y + offsetY;
      const hit = placed.some((p) =>
        overlaps(cx, cy, p.x + p.offsetX, p.y + p.offsetY),
      );
      if (!hit) break;
      offsetY += SCHEDULE_CARD_STACK_PX;
    }
    placed.push({ ...card, offsetX, offsetY });
  }

  return placed.map(({ id, offsetX, offsetY }) => ({ id, offsetX, offsetY }));
}

export function scheduleCardTransform(
  offsetX: number,
  offsetY: number,
): string | undefined {
  if (offsetX === 0 && offsetY === 0) return undefined;
  return `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

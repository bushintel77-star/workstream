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

/** Approximate card footprint for collision (screen px). */
export const SCHEDULE_CARD_W = 120;
export const SCHEDULE_CARD_H = 48;
/** Vertical stack step when two cards would share a point / collide. */
export const SCHEDULE_CARD_STACK_PX = 56;

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
    let offsetY = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const cy = card.y + offsetY;
      const hit = placed.some((p) =>
        overlaps(card.x, cy, p.x + p.offsetX, p.y + p.offsetY),
      );
      if (!hit) break;
      offsetY += SCHEDULE_CARD_STACK_PX;
    }
    const cx = card.x;
    const offsetX = Number.isFinite(maxCenterX) && cx > maxCenterX
      ? maxCenterX - cx
      : 0;
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

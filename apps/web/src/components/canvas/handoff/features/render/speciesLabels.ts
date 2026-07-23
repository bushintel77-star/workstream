/**
 * Screen-px declutter for presentation species labels.
 * Labels stack with a fixed screen-pixel gap (zoom-invariant).
 */

export type LabelCandidate = {
  id: string;
  /** Board % anchor (item centre). */
  xPct: number;
  yPct: number;
  text: string;
  /** Screen-space size of the symbol (for LOD gate). */
  screenPx: number;
};

export type PlacedLabel = LabelCandidate & {
  /** Screen-space offset applied after projecting the anchor. */
  offsetYPx: number;
};

const MIN_SCREEN_PX = 44;
const LABEL_GAP_PX = 16;
const LABEL_H_PX = 14;

/**
 * Keep labels whose symbol is ≥ ~44 screen px, then stack-offset collisions
 * in screen Y (like area callouts).
 */
export function placeSpeciesLabels(
  candidates: LabelCandidate[],
  project: (xPct: number, yPct: number) => { x: number; y: number },
): PlacedLabel[] {
  const eligible = candidates
    .filter((c) => c.screenPx >= MIN_SCREEN_PX)
    .sort((a, b) => a.yPct - b.yPct || a.xPct - b.xPct);

  const placed: PlacedLabel[] = [];
  const occupied: Array<{ x: number; y: number }> = [];

  for (const c of eligible) {
    const p = project(c.xPct, c.yPct);
    let offsetY = -Math.max(18, c.screenPx * 0.55);
    let guard = 0;
    while (guard < 12) {
      const y = p.y + offsetY;
      const hit = occupied.some(
        (o) => Math.abs(o.x - p.x) < 120 && Math.abs(o.y - y) < LABEL_GAP_PX,
      );
      if (!hit) break;
      offsetY -= LABEL_H_PX + 4;
      guard += 1;
    }
    occupied.push({ x: p.x, y: p.y + offsetY });
    placed.push({ ...c, offsetYPx: offsetY });
  }
  return placed;
}

export const SPECIES_LABEL_MIN_PX = MIN_SCREEN_PX;

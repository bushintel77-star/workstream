import type { StudioItem } from "../studioCatalog";

const NEAR_PCT = 6;

/**
 * Flag pending ghosts near a changed accepted item (handoff ~6 % proximity).
 * Called from the single mutate write-path after item diffs.
 */
export function markStaleGhostsNearEdit(
  before: StudioItem[],
  after: StudioItem[],
): StudioItem[] {
  const beforeAccepted = new Map(
    before.filter((i) => !i.ghost).map((i) => [i.id, i]),
  );
  const changedCenters: { x: number; y: number }[] = [];

  for (const next of after.filter((i) => !i.ghost)) {
    const prev = beforeAccepted.get(next.id);
    if (!prev) {
      // newly accepted — skip
      continue;
    }
    if (
      prev.x !== next.x ||
      prev.y !== next.y ||
      prev.scale !== next.scale ||
      prev.rot !== next.rot
    ) {
      changedCenters.push({ x: next.x, y: next.y });
    }
  }

  for (const prev of beforeAccepted.values()) {
    if (!after.some((i) => i.id === prev.id && !i.ghost)) {
      changedCenters.push({ x: prev.x, y: prev.y });
    }
  }

  if (changedCenters.length === 0) return after;

  return after.map((item) => {
    if (!item.ghost || item.stale) return item;
    const near = changedCenters.some(
      (c) => Math.hypot(c.x - item.x, c.y - item.y) <= NEAR_PCT,
    );
    return near ? { ...item, stale: true } : item;
  });
}

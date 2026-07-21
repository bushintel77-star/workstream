import type { StudioItem } from "../studioCatalog";

export type HistoryProvenance = "ai" | "manual";

/** Classify an operation, not an item: ghost lifecycle changes are AI work. */
export function classifyHistoryProvenance(
  before: StudioItem[],
  after: StudioItem[],
): HistoryProvenance {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));

  for (const item of before) {
    const next = afterById.get(item.id);
    if (item.ghost && (!next || next.ghost !== item.ghost)) return "ai";
  }
  for (const item of after) {
    const previous = beforeById.get(item.id);
    if (item.ghost && (!previous || previous.ghost !== item.ghost)) return "ai";
  }
  return "manual";
}

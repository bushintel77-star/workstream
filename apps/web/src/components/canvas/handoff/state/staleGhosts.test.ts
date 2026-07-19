import { describe, expect, it } from "vitest";
import type { StudioItem } from "../studioCatalog";
import { markStaleGhostsNearEdit } from "./staleGhosts";

function item(
  partial: Partial<StudioItem> & Pick<StudioItem, "id" | "t" | "x" | "y">,
): StudioItem {
  return {
    rot: 0,
    scale: 1,
    ghost: false,
    ...partial,
  };
}

describe("markStaleGhostsNearEdit", () => {
  it("flags nearby pending ghosts when an accepted item moves", () => {
    const before = [
      item({ id: "deck", t: "deck", x: 40, y: 60 }),
      item({
        id: "g1",
        t: "canopy",
        x: 41,
        y: 61,
        ghost: true,
        why: "shade",
        conf: 0.9,
      }),
    ];
    const after = [
      item({ id: "deck", t: "deck", x: 42, y: 62 }),
      before[1]!,
    ];
    const next = markStaleGhostsNearEdit(before, after);
    expect(next.find((i) => i.id === "g1")?.stale).toBe(true);
  });

  it("leaves distant ghosts unmarked", () => {
    const before = [
      item({ id: "deck", t: "deck", x: 40, y: 60 }),
      item({ id: "g1", t: "canopy", x: 10, y: 10, ghost: true }),
    ];
    const after = [
      item({ id: "deck", t: "deck", x: 41, y: 60 }),
      before[1]!,
    ];
    const next = markStaleGhostsNearEdit(before, after);
    expect(next.find((i) => i.id === "g1")?.stale).toBeFalsy();
  });
});

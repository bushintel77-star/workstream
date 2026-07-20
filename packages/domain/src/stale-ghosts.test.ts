import { describe, expect, it } from "vitest";
import { markStaleGhostsNearEdit } from "./stale-ghosts";

describe("markStaleGhostsNearEdit", () => {
  it("flags ghosts within radius of an edit", () => {
    const next = markStaleGhostsNearEdit(
      [
        { id: "a", x_pct: 50, y_pct: 50 },
        { id: "b", x_pct: 90, y_pct: 90 },
      ],
      [{ x_pct: 52, y_pct: 51 }],
      6,
    );
    expect(next[0]!.stale).toBe(true);
    expect(next[1]!.stale).toBeUndefined();
  });

  it("keeps already-stale ghosts stale", () => {
    const next = markStaleGhostsNearEdit(
      [{ id: "a", x_pct: 10, y_pct: 10, stale: true }],
      [{ x_pct: 80, y_pct: 80 }],
      6,
    );
    expect(next[0]!.stale).toBe(true);
  });

  it("no-ops when ghosts or edits are empty", () => {
    const ghosts = [{ id: "a", x_pct: 1, y_pct: 1 }];
    expect(markStaleGhostsNearEdit(ghosts, [])).toBe(ghosts);
    expect(markStaleGhostsNearEdit([], [{ x_pct: 1, y_pct: 1 }])).toEqual([]);
  });
});

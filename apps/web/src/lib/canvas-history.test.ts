import { describe, expect, it } from "vitest";
import {
  createCanvasHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./canvas-history";

describe("canvas-history", () => {
  it("undoes and redoes snapshots", () => {
    let h = createCanvasHistory<number>();
    h = pushHistory(h, 1);
    h = pushHistory(h, 2);
    const u = undoHistory(h, 3);
    expect(u).not.toBeNull();
    expect(u!.snapshot).toBe(2);
    const r = redoHistory(u!.history, u!.snapshot);
    expect(r).not.toBeNull();
    expect(r!.snapshot).toBe(3);
  });

  it("caps undo stack at limit", () => {
    let h = createCanvasHistory<number>();
    for (let i = 0; i < 45; i++) h = pushHistory(h, i, 40);
    expect(h.undoStack.length).toBe(40);
    expect(h.undoStack[0]).toBe(5);
  });

  it("clears redo on new push", () => {
    let h = pushHistory(createCanvasHistory<number>(), 1);
    const u = undoHistory(h, 2)!;
    h = pushHistory(u.history, 9);
    expect(h.redoStack).toEqual([]);
  });
});

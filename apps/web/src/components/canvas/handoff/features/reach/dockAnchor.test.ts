import { describe, expect, it } from "vitest";
import { resolveDockAnchor } from "./dockAnchor";

describe("resolveDockAnchor", () => {
  it("opens rightward from the left gutter", () => {
    const a = resolveDockAnchor(10, 50);
    expect(a.side).toBe("left");
  });

  it("opens leftward from the right gutter", () => {
    const a = resolveDockAnchor(88, 50);
    expect(a.side).toBe("right");
  });

  it("clamps the vertical centre so a tall popup stays on-canvas", () => {
    expect(resolveDockAnchor(10, 2).y).toBe(28);
    expect(resolveDockAnchor(10, 98).y).toBe(72);
  });

  it("keeps the pinned edge inside the board", () => {
    expect(resolveDockAnchor(-20, 50).x).toBe(6);
    expect(resolveDockAnchor(150, 50).x).toBe(94);
  });
});

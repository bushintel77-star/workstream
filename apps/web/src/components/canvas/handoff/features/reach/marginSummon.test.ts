import { describe, expect, it } from "vitest";
import { clampToCanvasMargin } from "./marginSummon";

describe("clampToCanvasMargin", () => {
  it("pushes a centre click into a side gutter", () => {
    const left = clampToCanvasMargin(48, 50);
    expect(left.x).toBeLessThan(24);
    const right = clampToCanvasMargin(62, 50);
    expect(right.x).toBeGreaterThan(76);
  });

  it("keeps an already-marginal click near the margin", () => {
    const m = clampToCanvasMargin(12, 40);
    expect(m.x).toBeLessThanOrEqual(14);
    expect(m.y).toBeGreaterThanOrEqual(14);
  });
});

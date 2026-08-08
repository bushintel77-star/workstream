import { describe, expect, it } from "vitest";
import { estimateStructuredStrokeCost } from "./structured-stroke-cost";

describe("estimateStructuredStrokeCost", () => {
  it("estimates ditch cost from length", () => {
    const est = estimateStructuredStrokeCost("ditch", [
      { x_pct: 10, y_pct: 50 },
      { x_pct: 40, y_pct: 50 },
    ]);
    expect(est).not.toBeNull();
    expect(est!.length_m).toBeGreaterThan(0);
    expect(est!.cost_aud).toBeGreaterThan(0);
  });

  it("returns null for single point", () => {
    expect(
      estimateStructuredStrokeCost("path", [{ x_pct: 10, y_pct: 10 }]),
    ).toBeNull();
  });
});

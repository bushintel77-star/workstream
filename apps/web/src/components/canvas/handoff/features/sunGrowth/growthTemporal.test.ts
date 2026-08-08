import { describe, expect, it } from "vitest";
import {
  growthStageFromIndex,
  growthStageIndex,
  growthStageLabel,
  GROWTH_TEMPORAL_STAGES,
} from "./growthTemporal";

describe("growthTemporal", () => {
  it("exposes Year 1 / Year 5 / Year 10 labels", () => {
    expect(GROWTH_TEMPORAL_STAGES.map((s) => s.label)).toEqual([
      "Year 1",
      "Year 5",
      "Year 10",
    ]);
  });

  it("round-trips index ↔ stage", () => {
    expect(growthStageFromIndex(growthStageIndex("5yr"))).toBe("5yr");
    expect(growthStageFromIndex(2)).toBe("mature");
    expect(growthStageFromIndex(99)).toBe("mature");
  });

  it("labels mature as Year 10", () => {
    expect(growthStageLabel("mature")).toBe("Year 10");
  });
});

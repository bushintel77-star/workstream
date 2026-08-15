import { describe, expect, it } from "vitest";
import { classifyEnvelope } from "./EnvelopeBand";
import type { EnvelopeBrief } from "../../../../../lib/api";

const envelope = (low: number, high: number): EnvelopeBrief => ({
  markdown: "",
  budget_low: low,
  budget_mid: (low + high) / 2,
  budget_high: high,
  planning_flags: [],
});

describe("classifyEnvelope", () => {
  it("places a total inside the band", () => {
    expect(classifyEnvelope(100, envelope(80, 120))).toEqual({
      state: "inside",
      pct: 0,
    });
  });

  it("flags a total above the high band with overshoot pct", () => {
    const r = classifyEnvelope(180, envelope(80, 120));
    expect(r?.state).toBe("above");
    expect(r?.pct).toBeCloseTo(50, 5);
  });

  it("flags a total below the low band with undershoot pct", () => {
    const r = classifyEnvelope(40, envelope(80, 120));
    expect(r?.state).toBe("below");
    expect(r?.pct).toBeCloseTo(50, 5);
  });

  it("returns null without a brief or with an unusable band", () => {
    expect(classifyEnvelope(100, null)).toBeNull();
    expect(classifyEnvelope(100, envelope(0, 0))).toBeNull();
    expect(classifyEnvelope(100, envelope(120, 80))).toBeNull();
  });
});

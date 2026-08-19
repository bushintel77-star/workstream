import { describe, expect, it } from "vitest";
import {
  boardScaleM,
  pickMetricStepM,
  resolveGroundPhase,
  visibleMetres,
} from "./groundMetrics";

describe("groundMetrics", () => {
  it("scales board metres with sheet denominator", () => {
    expect(boardScaleM(100)).toBe(110);
    expect(boardScaleM(50)).toBe(55);
    expect(boardScaleM(200)).toBe(220);
  });

  it("picks denser steps when zoomed in", () => {
    expect(pickMetricStepM(30)).toBe(1);
    expect(pickMetricStepM(100)).toBe(10);
    expect(pickMetricStepM(500)).toBe(50);
  });

  it("resolves ground phase from aerial / cadastral intent", () => {
    expect(
      resolveGroundPhase({ hasAerial: false, hasBoundary: false, address: "" }),
    ).toBe("paper");
    expect(
      resolveGroundPhase({
        hasAerial: false,
        hasBoundary: true,
        address: "12 Wrights Terrace, Prahran",
      }),
    ).toBe("cadastral");
    expect(
      resolveGroundPhase({
        hasAerial: true,
        hasBoundary: true,
        address: "12 Wrights Terrace, Prahran",
      }),
    ).toBe("aerial");
  });

  it("visible metres shrink with zoom", () => {
    expect(visibleMetres(100, 2)).toBe(55);
  });
});

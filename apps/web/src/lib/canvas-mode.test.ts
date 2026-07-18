import { describe, expect, it } from "vitest";
import {
  resolveCanvasMode,
  suggestedMode,
  unlockedModes,
} from "./canvas-mode";

describe("canvas progressive disclosure", () => {
  it("starts with survey only", () => {
    const open = unlockedModes({
      hasAerial: false,
      hasSketch: false,
      hasCad: false,
      hasQuote: false,
    });
    expect([...open]).toEqual(["survey"]);
    expect(suggestedMode({
      hasAerial: false,
      hasSketch: false,
      hasCad: false,
      hasQuote: false,
    })).toBe("survey");
  });

  it("unlocks sketch and cad after aerial", () => {
    const open = unlockedModes({
      hasAerial: true,
      hasSketch: false,
      hasCad: false,
      hasQuote: false,
    });
    expect(open.has("sketch")).toBe(true);
    expect(open.has("cad")).toBe(true);
    expect(open.has("quote")).toBe(false);
  });

  it("clamps locked mode requests to the suggested next step", () => {
    expect(
      resolveCanvasMode("quote", {
        hasAerial: true,
        hasSketch: false,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("sketch");
  });

  it("honours unlocked mode from URL", () => {
    expect(
      resolveCanvasMode("cad", {
        hasAerial: true,
        hasSketch: true,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("cad");
  });
});

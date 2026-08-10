import { describe, expect, it } from "vitest";
import {
  modeForLegacyPath,
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
    expect(
      suggestedMode({
        hasAerial: false,
        hasSketch: false,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("survey");
  });

  it("unlocks sketch, CAD, and elevation after aerial", () => {
    const open = unlockedModes({
      hasAerial: true,
      hasSketch: false,
      hasCad: false,
      hasQuote: false,
    });
    expect(open.has("sketch")).toBe(true);
    expect(open.has("cad")).toBe(true);
    expect(open.has("elevation")).toBe(true);
    expect(open.has("quote")).toBe(false);
    expect(
      suggestedMode({
        hasAerial: true,
        hasSketch: false,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("sketch");
  });

  it("keeps CAD unlocked with or without sketch placements", () => {
    const open = unlockedModes({
      hasAerial: true,
      hasSketch: true,
      hasCad: false,
      hasQuote: false,
    });
    expect(open.has("cad")).toBe(true);
    expect(open.has("quote")).toBe(false);
  });

  it("unlocks Quote after accepted CAD, Share after persisted quote", () => {
    const withCad = unlockedModes({
      hasAerial: true,
      hasSketch: true,
      hasCad: true,
      hasQuote: false,
    });
    expect(withCad.has("quote")).toBe(true);
    expect(withCad.has("share")).toBe(false);

    const withQuote = unlockedModes({
      hasAerial: true,
      hasSketch: true,
      hasCad: true,
      hasQuote: true,
    });
    expect(withQuote.has("share")).toBe(true);
  });

  it("honours CAD from title click without sketch", () => {
    expect(
      resolveCanvasMode("cad", {
        hasAerial: true,
        hasSketch: false,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("cad");
  });

  it("clamps Quote until accepted CAD exists", () => {
    expect(
      resolveCanvasMode("quote", {
        hasAerial: true,
        hasSketch: true,
        hasCad: false,
        hasQuote: false,
      }),
    ).toBe("cad");
  });

  it("maps develop to quote and overview to sketch", () => {
    expect(modeForLegacyPath("/projects/x/design/develop")).toBe("quote");
    expect(modeForLegacyPath("/projects/x/overview")).toBe("sketch");
    expect(modeForLegacyPath("/projects/x/processing")).toBe("sketch");
  });

});

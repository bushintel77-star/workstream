import { describe, expect, it } from "vitest";

/**
 * Drawing-plane law: barren-lot onboarding must unmount when vectors exist
 * or a tool is armed — mirrors AerialSlot showDropCue gating.
 */
function showDropCue(opts: {
  uri: string | null;
  underlayEnabled: boolean;
  hasGeometry: boolean;
  canvasEngaged: boolean;
  titleLocked?: boolean;
  suppressSiteCue?: boolean;
  frameOn?: boolean;
  foundationCleanse?: boolean;
}): boolean {
  return (
    !opts.uri &&
    opts.underlayEnabled &&
    !opts.hasGeometry &&
    !opts.canvasEngaged &&
    !opts.titleLocked &&
    !opts.suppressSiteCue &&
    !opts.frameOn &&
    !opts.foundationCleanse
  );
}

describe("aerial drop cue gating", () => {
  it("shows only on a barren idle lot", () => {
    expect(
      showDropCue({
        uri: null,
        underlayEnabled: true,
        hasGeometry: false,
        canvasEngaged: false,
      }),
    ).toBe(true);
  });

  it("unmounts when geometry exists", () => {
    expect(
      showDropCue({
        uri: null,
        underlayEnabled: true,
        hasGeometry: true,
        canvasEngaged: false,
      }),
    ).toBe(false);
  });

  it("unmounts when a tool is armed", () => {
    expect(
      showDropCue({
        uri: null,
        underlayEnabled: true,
        hasGeometry: false,
        canvasEngaged: true,
      }),
    ).toBe(false);
  });

  it("unmounts when an underlay uri is active", () => {
    expect(
      showDropCue({
        uri: "data:image/png;base64,xx",
        underlayEnabled: true,
        hasGeometry: false,
        canvasEngaged: false,
      }),
    ).toBe(false);
  });

  it("unmounts on Vicmap / title-locked sites", () => {
    expect(
      showDropCue({
        uri: null,
        underlayEnabled: true,
        hasGeometry: false,
        canvasEngaged: false,
        titleLocked: true,
      }),
    ).toBe(false);
  });
});

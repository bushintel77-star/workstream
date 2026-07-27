import { describe, expect, it } from "vitest";
import {
  categoryForSwatch,
  collapseLeftAssetPanel,
  collapseLeftAssetUnlessPinned,
  needsPathGrammar,
  openLeftAssetExclusive,
  resolveLeftSafeInsetPx,
  shouldAutoCollapseLeftAsset,
  toggleRightDataPanelExclusive,
} from "./leftAssetPanel";

describe("leftAssetPanel", () => {
  it("maps Bluestone rail to Hardscape category", () => {
    expect(categoryForSwatch("paving")).toBe("paving");
    expect(categoryForSwatch("deck")).toBe("paving");
    expect(categoryForSwatch("bed")).toBe("planting");
  });

  it("flags paving/deck for Path Grammar", () => {
    expect(needsPathGrammar("paving")).toBe(true);
    expect(needsPathGrammar("deck")).toBe(true);
    expect(needsPathGrammar("lawn")).toBe(false);
  });

  it("opens left panel exclusive of right data lane", () => {
    expect(openLeftAssetExclusive("expanded")).toEqual({
      leftAssetPanel: "expanded",
      rightDataPanel: null,
    });
  });

  it("toggling right panel collapses left asset panel", () => {
    expect(toggleRightDataPanelExclusive(null, "layers")).toEqual({
      rightDataPanel: "layers",
      leftAssetPanel: null,
      ghostReviewOpen: false,
    });
    expect(toggleRightDataPanelExclusive("layers", "layers")).toEqual({
      rightDataPanel: null,
      leftAssetPanel: null,
    });
  });

  it("collapse clears restore snapshot", () => {
    expect(collapseLeftAssetPanel()).toEqual({
      leftAssetPanel: null,
      leftAssetRestore: null,
    });
  });

  it("resolveLeftSafeInsetPx bumps for collapsed rail and open library", () => {
    expect(resolveLeftSafeInsetPx(null, true)).toBe(120);
    expect(resolveLeftSafeInsetPx("expanded", false)).toBeUndefined();
    expect(resolveLeftSafeInsetPx("expanded", true)).toBe(420);
    expect(resolveLeftSafeInsetPx("placing", true)).toBe(340);
  });

  it("auto-collapses expanded library only when unpinned", () => {
    expect(
      shouldAutoCollapseLeftAsset({ panel: "expanded", pinned: false }),
    ).toBe(true);
    expect(
      shouldAutoCollapseLeftAsset({ panel: "expanded", pinned: true }),
    ).toBe(false);
    expect(
      shouldAutoCollapseLeftAsset({ panel: "placing", pinned: false }),
    ).toBe(false);
    expect(
      collapseLeftAssetUnlessPinned({ panel: "expanded", pinned: false }),
    ).toEqual({ leftAssetPanel: null, leftAssetRestore: null });
    expect(
      collapseLeftAssetUnlessPinned({ panel: "expanded", pinned: true }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  categoryForSwatch,
  collapseLeftAssetPanel,
  needsPathGrammar,
  openLeftAssetExclusive,
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
});

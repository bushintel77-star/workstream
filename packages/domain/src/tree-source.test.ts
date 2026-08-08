import { describe, expect, it } from "vitest";
import {
  canDeriveTpz,
  isIndicativeCanopySource,
  treeSourceLabel,
  treeSourceShortTag,
} from "./tree-source";

describe("treeSourceLabel", () => {
  it("names a Vicmap tree as approximate, confirm on site", () => {
    expect(treeSourceLabel("vicmap_tree")).toBe(
      "Vicmap urban tree · approximate · confirm on site",
    );
  });

  it("names a detected canopy as indicative, not survey or council data", () => {
    expect(treeSourceLabel("canopy")).toBe(
      "Indicative canopy · detected from aerial imagery · not survey or council data · confirm on site",
    );
  });

  it("never collapses a canopy to just 'tree'", () => {
    expect(treeSourceLabel("canopy")).not.toMatch(/^\s*tree/i);
    expect(treeSourceLabel("canopy")).toMatch(/canopy/);
  });

  it("folds the imagery capture date into the canopy label", () => {
    expect(treeSourceLabel("canopy", { captureDate: "2023" })).toBe(
      "Indicative canopy · detected from 2023 imagery · not survey or council data · confirm on site",
    );
  });

  it("is empty for an operator-placed tree (no provenance to assert)", () => {
    expect(treeSourceLabel("operator")).toBe("");
    expect(treeSourceLabel(null)).toBe("");
    expect(treeSourceLabel(undefined)).toBe("");
  });
});

describe("treeSourceShortTag", () => {
  it("gives the elevation callout a short Vicmap tag", () => {
    expect(treeSourceShortTag("vicmap_tree")).toBe("Vicmap urban tree");
  });

  it("gives the elevation callout a short indicative canopy tag", () => {
    expect(treeSourceShortTag("canopy")).toBe("Indicative canopy");
  });

  it("is null for an operator tree so the elevation keeps its default tag", () => {
    expect(treeSourceShortTag("operator")).toBeNull();
  });
});

describe("isIndicativeCanopySource", () => {
  it("is true only for the canopy source — Vicmap is a real record", () => {
    expect(isIndicativeCanopySource("canopy")).toBe(true);
    expect(isIndicativeCanopySource("vicmap_tree")).toBe(false);
    expect(isIndicativeCanopySource("operator")).toBe(false);
    expect(isIndicativeCanopySource(null)).toBe(false);
  });
});

describe("canDeriveTpz", () => {
  it("blocks AS 4970 TPZ for a vision-detected canopy (no trunk, no DBH)", () => {
    expect(canDeriveTpz("canopy")).toBe(false);
  });

  it("allows an indicative TPZ for a Vicmap tree (real trunk, default DBH caveat)", () => {
    expect(canDeriveTpz("vicmap_tree")).toBe(true);
  });

  it("allows TPZ for an operator-placed / surveyed tree", () => {
    expect(canDeriveTpz("operator")).toBe(true);
    expect(canDeriveTpz(null)).toBe(true);
  });
});

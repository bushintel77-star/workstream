import { describe, expect, it } from "vitest";
import type { KeylessOverlayKind } from "@workstream/contracts";
import {
  OVERLAY_COLORS,
  OVERLAY_LABELS,
  OVERLAY_ORDER,
  isOverlayVisible,
} from "./overlayMeta";

const ALL_KINDS: KeylessOverlayKind[] = [
  "planning",
  "bushfire",
  "contour",
  "flood",
  "heritage",
  "easement",
  "urban_tree",
  "water_corp",
  "road_casement",
  "acid_sulfate",
  "wetland",
  "native_vegetation",
];

describe("overlayMeta", () => {
  it("covers every overlay kind with a colour and label", () => {
    for (const kind of ALL_KINDS) {
      expect(OVERLAY_COLORS[kind]).toBeTruthy();
      expect(OVERLAY_LABELS[kind]).toBeTruthy();
    }
    expect(OVERLAY_ORDER).toHaveLength(ALL_KINDS.length);
    expect(new Set(OVERLAY_ORDER)).toEqual(new Set(ALL_KINDS));
  });

  it("isOverlayVisible: absent from the hidden set means visible", () => {
    expect(isOverlayVisible([], "planning")).toBe(true);
    expect(isOverlayVisible(["planning"], "planning")).toBe(false);
    expect(isOverlayVisible(["planning"], "easement")).toBe(true);
  });
});

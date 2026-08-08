import { describe, expect, it } from "vitest";
import {
  ANNOTATION_LOD_HIGH,
  ANNOTATION_LOD_MID,
  ANNOTATION_LOD_PRINCIPAL_MAX,
  filterDimsForAnnotationLod,
  lodRamp,
  resolveAnnotationLod,
} from "./annotationLod";

describe("lodRamp", () => {
  it("is 0 below the fade band and 1 at/above enter", () => {
    expect(lodRamp(0.5, ANNOTATION_LOD_MID, 0.12)).toBe(0);
    expect(lodRamp(ANNOTATION_LOD_MID, ANNOTATION_LOD_MID, 0.12)).toBe(1);
    expect(lodRamp(1.2, ANNOTATION_LOD_MID, 0.12)).toBe(1);
  });

  it("cross-fades linearly inside the band", () => {
    const mid = lodRamp(ANNOTATION_LOD_MID - 0.06, ANNOTATION_LOD_MID, 0.12);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });
});

describe("resolveAnnotationLod", () => {
  it("keeps only lot area at wide overview zoom", () => {
    const lod = resolveAnnotationLod(0.4);
    expect(lod.tier).toBe("low");
    expect(lod.lotArea).toBe(true);
    expect(lod.dims).toBe(false);
    expect(lod.contextAreas).toBe(false);
    expect(lod.species).toBe(false);
    expect(lod.rl).toBe(false);
    expect(lod.opacity.dims).toBe(0);
  });

  it("adds principal dims at mid zoom", () => {
    const lod = resolveAnnotationLod(1);
    expect(lod.tier).toBe("mid");
    expect(lod.dims).toBe(true);
    expect(lod.allEdgeDims).toBe(false);
    expect(lod.contextAreas).toBe(true);
    expect(lod.species).toBe(false);
    expect(lod.principalMax).toBe(ANNOTATION_LOD_PRINCIPAL_MAX);
  });

  it("opens full edge set, species and RL at high / precision zoom", () => {
    const lod = resolveAnnotationLod(ANNOTATION_LOD_HIGH);
    expect(lod.tier).toBe("high");
    expect(lod.allEdgeDims).toBe(true);
    expect(lod.species).toBe(true);
    expect(lod.rl).toBe(true);
    expect(lod.opacity.species).toBe(1);
    expect(lod.opacity.rl).toBe(1);
  });

  it("clamps non-finite zoom to the default mid band", () => {
    expect(resolveAnnotationLod(Number.NaN).tier).toBe("mid");
  });
});

describe("filterDimsForAnnotationLod", () => {
  const dims = [
    { key: "B1", lengthM: 12, visible: true },
    { key: "B2", lengthM: 4, visible: true },
    { key: "B3", lengthM: 20, visible: true },
    { key: "B4", lengthM: 8, visible: true },
    { key: "B5", lengthM: 3, visible: false },
    { key: "B6", lengthM: 15, visible: true },
    { key: "B7", lengthM: 9, visible: true },
    { key: "B8", lengthM: 7, visible: true },
    { key: "B9", lengthM: 6, visible: true },
  ];

  it("hides every dim at low zoom", () => {
    const out = filterDimsForAnnotationLod(dims, resolveAnnotationLod(0.4));
    expect(out.every((d) => !d.visible)).toBe(true);
  });

  it("keeps the longest principal edges at mid zoom", () => {
    const out = filterDimsForAnnotationLod(dims, resolveAnnotationLod(1));
    const kept = out.filter((d) => d.visible).map((d) => d.key);
    expect(kept.sort()).toEqual(
      ["B1", "B3", "B4", "B6", "B7", "B8"].sort(),
    );
    expect(kept).not.toContain("B2");
    expect(kept).not.toContain("B5");
    expect(kept).not.toContain("B9");
  });

  it("passes declutter visibility through at high zoom", () => {
    const out = filterDimsForAnnotationLod(
      dims,
      resolveAnnotationLod(ANNOTATION_LOD_HIGH),
    );
    expect(out.filter((d) => d.visible).map((d) => d.key)).toEqual([
      "B1",
      "B2",
      "B3",
      "B4",
      "B6",
      "B7",
      "B8",
      "B9",
    ]);
  });
});

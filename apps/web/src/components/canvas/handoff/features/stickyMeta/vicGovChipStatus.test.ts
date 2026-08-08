import { describe, expect, it } from "vitest";
import { buildVicGovChipModels } from "./vicGovChipStatus";

const ring = [
  { x: 10, y: 10 },
  { x: 40, y: 10 },
  { x: 40, y: 40 },
  { x: 10, y: 40 },
];

describe("buildVicGovChipModels", () => {
  it("marks boundary Vicmap when source is vicmap", () => {
    const chips = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
      boundarySource: "vicmap",
    });
    const b = chips.find((c) => c.id === "boundary");
    expect(b?.face).toBe("Vicmap");
    expect(b?.tone).toBe("ok");
  });

  it("easements clean when none; flag when found", () => {
    const clean = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
      boundarySource: "vicmap",
    });
    expect(clean.find((c) => c.id === "easements")?.tone).toBe("ok");

    const flagged = buildVicGovChipModels({
      boundary: ring,
      easements: [ring],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
      boundarySource: "vicmap",
    });
    expect(flagged.find((c) => c.id === "easements")?.face).toBe("1 found");
    expect(flagged.find((c) => c.id === "easements")?.tone).toBe("flag");
  });

  it("hides heritage unless HO/heritage overlay present", () => {
    const none = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
    });
    expect(none.some((c) => c.id === "heritage")).toBe(false);

    const withHo = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [
        {
          kind: "heritage",
          label: "HO120",
          rings: [],
        },
      ],
      items: [],
      bydaAssets: [],
    });
    expect(withHo.some((c) => c.id === "heritage")).toBe(true);
  });

  it("BYDA warns until assets or chase done", () => {
    const warn = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
      sitePackChase: [{ id: "byda", done: false }],
    });
    expect(warn.find((c) => c.id === "byda")?.tone).toBe("warn");

    const ok = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [
        {
          id: "a1",
          kind: "sewer",
          source: "byda",
          ring: [
            { x_pct: 1, y_pct: 1 },
            { x_pct: 2, y_pct: 2 },
          ],
        },
      ],
    });
    expect(ok.find((c) => c.id === "byda")?.tone).toBe("ok");
  });

  it("includes Env chip for sun scrubber access", () => {
    const chips = buildVicGovChipModels({
      boundary: ring,
      easements: [],
      keylessOverlays: [],
      items: [],
      bydaAssets: [],
      envFace: "12.4 h sun",
      shadeOn: true,
    });
    const env = chips.find((c) => c.id === "environment");
    expect(env?.panel).toBe("environment");
    expect(env?.face).toContain("12.4");
  });
});

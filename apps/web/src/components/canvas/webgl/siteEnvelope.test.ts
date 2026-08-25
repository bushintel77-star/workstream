import { describe, expect, it } from "vitest";
import type { DesignKeylessOverlay } from "@workstream/contracts";
import { buildStudioSiteEnvelope } from "./siteEnvelope";
import { buildMetaChips } from "./metaChips";
import type { HeightmapPoint } from "./coordTransform";

const MELB = { lat: -37.8136, lng: 144.9631 };

const ov = (kind: DesignKeylessOverlay["kind"], label?: string): DesignKeylessOverlay =>
  ({ kind, rings: [], ...(label ? { label } : {}) }) as DesignKeylessOverlay;

/** Bowl terrain — high edges, one deep centre pit → a D8 ponding point. */
function bowl(): HeightmapPoint[] {
  const pts: HeightmapPoint[] = [];
  const R = 30;
  for (let x = -R; x <= R; x += 10) {
    for (let z = -R; z <= R; z += 10) {
      const d = Math.hypot(x, z);
      pts.push({ x, z, y: d > 20 ? 51.2 : d > 5 ? 50.6 : 49.4 });
    }
  }
  return pts;
}

describe("buildStudioSiteEnvelope", () => {
  it("returns null without a geolocated pin (absent data → absent chip)", () => {
    expect(
      buildStudioSiteEnvelope({
        lat: null,
        lng: null,
        overlays: [],
        heightmapPoints: [],
        scaleM: 100,
        boardAspect: 1,
      }),
    ).toBeNull();
  });

  it("fuses overlay flags into wetness drivers and validates through zod", () => {
    const env = buildStudioSiteEnvelope({
      ...MELB,
      overlays: [
        ov("flood", "LSIO"),
        ov("wetland", "Swampy woodland"),
        ov("acid_sulfate"),
        ov("native_vegetation", "Plains Grassy Woodland"),
      ],
      heightmapPoints: [],
      scaleM: 100,
      boardAspect: 1,
    });
    if (!env) throw new Error("unreachable");
    expect(env.wetness.class).toBe("flood_prone");
    expect(env.wetness.drivers.map((d) => d.kind)).toEqual(["flood_overlay", "wetland_overlay"]);
    expect(env.acidSulfate).toBe(true);
    expect(env.nativeVegetationLabel).toBe("Plains Grassy Woodland");
  });

  it("derives a ponding driver from real bowl terrain (the drainage layer's D8 grid)", () => {
    const env = buildStudioSiteEnvelope({
      ...MELB,
      overlays: [],
      heightmapPoints: bowl(),
      scaleM: 100,
      boardAspect: 1,
    });
    if (!env) throw new Error("unreachable");
    const pond = env.wetness.drivers.find((d) => d.kind === "ponding");
    expect(pond).toBeTruthy();
    expect(pond!.evidence).toMatch(/ponding point/);
    expect(env.slope).not.toBeNull();
    expect(env.summaryLine).toContain("·");
  });

  it("flat terrain with no overlays reads dry with no drivers", () => {
    const env = buildStudioSiteEnvelope({
      ...MELB,
      overlays: [],
      heightmapPoints: [
        { x: -10, z: -10, y: 50 },
        { x: 10, z: -10, y: 50 },
        { x: 0, z: 10, y: 50 },
      ],
      scaleM: 100,
      boardAspect: 1,
    });
    if (!env) throw new Error("unreachable");
    expect(env.wetness.class).toBe("dry");
    expect(env.wetness.drivers).toHaveLength(0);
  });
});

describe("site envelope chip", () => {
  it("buildMetaChips surfaces the envelope with drivers and honesty stamps", () => {
    const env = buildStudioSiteEnvelope({
      ...MELB,
      overlays: [ov("flood", "LSIO"), ov("native_vegetation", "Plains Grassy Woodland")],
      heightmapPoints: bowl(),
      scaleM: 100,
      boardAspect: 1,
    });
    if (!env) throw new Error("unreachable");
    const chips = buildMetaChips({ envelope: env });
    const chip = chips.find((c) => c.id === "site-envelope");
    if (!chip) throw new Error("envelope chip missing");
    expect(chip.value).toBe("Envelope");
    expect(chip.label).toContain("·");
    expect(chip.detail).toContain("flood prone");
    expect(chip.detail).toContain("ponding point");
    expect(chip.detail).toContain("Plains Grassy Woodland");
    expect(chip.detail).toContain("not a soil survey");
    expect(chip.brightModes).toEqual(["sketch", "cad", "garden"]);
  });
});

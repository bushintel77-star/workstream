import { describe, expect, it } from "vitest";
import {
  fixturesFromPlacements,
  isLightingSymbolId,
  nearestPointOnRing,
  proposeLandscapeServiceZones,
  zoneKindShortLabel,
} from "./landscape-services";

const building = [
  { x: 30, y: 20 },
  { x: 55, y: 20 },
  { x: 55, y: 45 },
  { x: 30, y: 45 },
  { x: 30, y: 20 },
];

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
  { x: 10, y: 10 },
];

describe("nearestPointOnRing", () => {
  it("snaps to the closest building edge", () => {
    const fit = nearestPointOnRing({ x: 70, y: 32 }, building);
    expect(fit).toBeTruthy();
    expect(fit!.x).toBeCloseTo(55, 0);
    expect(fit!.y).toBeCloseTo(32, 0);
  });
});

describe("isLightingSymbolId / fixturesFromPlacements", () => {
  it("recognises Curtis lighting SKUs", () => {
    expect(isLightingSymbolId("brass-uplight")).toBe(true);
    expect(isLightingSymbolId("path-spike-light")).toBe(true);
    expect(isLightingSymbolId("olive-standard")).toBe(false);
  });

  it("extracts fixture points from placements", () => {
    const pts = fixturesFromPlacements([
      { symbol_id: "brass-uplight", x_pct: 62, y_pct: 58 },
      { symbol_id: "olive-standard", x_pct: 40, y_pct: 40 },
      { symbol_id: "path-spike-light", x_pct: 74, y_pct: 60 },
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 62, y: 58 });
  });
});

describe("proposeLandscapeServiceZones", () => {
  it("snaps conduit from catalog fixtures before hardscape", () => {
    const res = proposeLandscapeServiceZones({
      building,
      boundary,
      items: [{ t: "paving", x: 40, y: 70 }],
      fixtures: [
        { x: 62, y: 58 },
        { x: 74, y: 60 },
      ],
      zones: [],
    });
    expect(res.zones.some((z) => z.kind === "lighting")).toBe(true);
    expect(res.zones.some((z) => z.kind === "lighting_conduit")).toBe(true);
    expect(res.tip).toMatch(/fixture/);
  });

  it("proposes lighting conduit fit-off from a lighting zone", () => {
    const res = proposeLandscapeServiceZones({
      building,
      items: [],
      zones: [
        {
          kind: "lighting",
          points: [
            { x: 60, y: 50 },
            { x: 75, y: 55 },
          ],
        },
      ],
    });
    const conduit = res.zones.find((z) => z.kind === "lighting_conduit");
    expect(conduit).toBeTruthy();
    const last = conduit!.points[conduit!.points.length - 1]!;
    expect(last.x).toBeLessThanOrEqual(55.1);
    expect(res.tip).toMatch(/LV trench/);
  });

  it("snaps agg drain PoD to boundary and tips legal PoD", () => {
    const res = proposeLandscapeServiceZones({
      building,
      boundary,
      items: [
        { t: "frenchdrain", x: 40, y: 70 },
        { t: "frenchdrain", x: 65, y: 72 },
      ],
      zones: [],
    });
    expect(res.wateringMode).toBe("agg_drain");
    const run = res.zones.find((z) => z.kind === "agg_drain")!;
    const pod = run.points[run.points.length - 1]!;
    expect(pod.x === 10 || pod.x === 90 || pod.y === 10 || pod.y === 90).toBe(
      true,
    );
    expect(res.tip).toMatch(/PoD/);
  });

  it("tips spray heads and valves for softscape", () => {
    const res = proposeLandscapeServiceZones({
      building,
      items: [
        { t: "lawn", x: 40, y: 60 },
        { t: "bed", x: 55, y: 65 },
      ],
      zones: [],
    });
    expect(res.wateringMode).toBe("spray");
    expect(res.tip).toMatch(/head/);
    expect(res.tip).toMatch(/valve/);
  });

  it("does not duplicate existing conduit / watering kinds", () => {
    const res = proposeLandscapeServiceZones({
      building,
      items: [{ t: "frenchdrain", x: 40, y: 70 }],
      zones: [
        {
          kind: "lighting_conduit",
          points: [
            { x: 60, y: 50 },
            { x: 55, y: 40 },
          ],
        },
        {
          kind: "agg_drain",
          points: [
            { x: 40, y: 70 },
            { x: 70, y: 75 },
          ],
        },
      ],
    });
    expect(res.zones).toHaveLength(0);
  });
});

describe("zoneKindShortLabel", () => {
  it("labels conduit and spray", () => {
    expect(zoneKindShortLabel("lighting_conduit")).toBe("LV conduit");
    expect(zoneKindShortLabel("spray")).toBe("Spray");
  });
});

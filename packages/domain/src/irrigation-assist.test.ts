import { describe, expect, it } from "vitest";
import type { CatalogPlacement, IrrigationZone } from "@workstream/contracts";
import {
  assistLightingPlacementLabel,
  clampEmitterSpacingCm,
  estimateIrrigationAssistLive,
  estimateLightingAssistLive,
  listAssistIrrigationZones,
  listAssistLightingPlacements,
  nudgeAssistLuminaires,
  proposeIrrigationAssist,
  proposeLightingAssist,
  scaleAssistPipeRuns,
  setAssistEmitterSpacing,
  summariseIrrigationAssist,
  summariseLightingAssist,
} from "./irrigation-assist";

const assistZone = (over: Partial<IrrigationZone> = {}): IrrigationZone => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Assist: Rear drip zone",
  kind: "drip",
  points: [
    { x_pct: 20, y_pct: 50 },
    { x_pct: 80, y_pct: 50 },
    { x_pct: 80, y_pct: 80 },
    { x_pct: 20, y_pct: 80 },
  ],
  emitter_spacing_cm: 30,
  emitter_flow_lph: 2,
  ...over,
});

const light = (over: Partial<CatalogPlacement> = {}): CatalogPlacement => ({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  symbol_id: "path-light",
  x_pct: 40,
  y_pct: 40,
  rotation_deg: 0,
  scale: 1,
  label: "Assist: Brass uplight",
  ...over,
});

describe("irrigation-assist", () => {
  it("proposes one zone for small sites, two for large", () => {
    let n = 0;
    const idFactory = () => `z-${++n}`;
    expect(
      proposeIrrigationAssist({ openAreaM2: 60, idFactory }),
    ).toHaveLength(1);
    expect(
      proposeIrrigationAssist({ openAreaM2: 140, idFactory }),
    ).toHaveLength(2);
  });

  it("places lighting near trees", () => {
    const pts = proposeLightingAssist(
      [
        {
          id: "t1",
          layer: "softscape",
          label: "Feature tree",
          symbol_id: "tree-canopy",
          source: "placement",
          area_m2: 0,
          length_m: 0,
          count: 1,
          x_pct: 40,
          y_pct: 40,
          mature_canopy_m: 4,
        },
      ],
      () => "light-1",
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]!.fixture).toMatch(/uplight/i);
  });

  it("summarises irrigation coverage and indicative cost", () => {
    const zones = proposeIrrigationAssist({
      openAreaM2: 140,
      idFactory: (() => {
        let n = 0;
        return () => `z-${++n}`;
      })(),
    });
    const summary = summariseIrrigationAssist(zones, 140);
    expect(summary.zone_count).toBe(2);
    expect(summary.open_area_m2).toBe(140);
    expect(summary.cost_aud).toBeGreaterThan(0);
    expect(summary.label).toMatch(/drip zone/i);
  });

  it("summarises lighting fixture cost", () => {
    const summary = summariseLightingAssist([
      {
        id: "l1",
        fixture: "Brass uplight",
        x_pct: 40,
        y_pct: 40,
        count: 2,
      },
    ]);
    expect(summary.fixture_count).toBe(2);
    expect(summary.cost_aud).toBeGreaterThan(0);
  });

  it("lists assist irrigation zones and clamps spacing", () => {
    const zones = [
      assistZone(),
      {
        ...assistZone({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "Spray path",
          kind: "spray" as const,
        }),
      },
    ];
    expect(listAssistIrrigationZones(zones)).toHaveLength(1);
    expect(clampEmitterSpacingCm(10)).toBe(15);
    expect(clampEmitterSpacingCm(90)).toBe(60);
    const next = setAssistEmitterSpacing(zones, 20);
    expect(next[0]!.emitter_spacing_cm).toBe(20);
    expect(next[1]!.emitter_spacing_cm).toBe(30);
  });

  it("scales pipe runs and live estimate tracks spacing + length", () => {
    const zones = [assistZone()];
    const base = estimateIrrigationAssistLive(zones, 80, 20);
    expect(base.pipe_m).toBeGreaterThan(0);
    expect(base.emitters).toBeGreaterThan(0);
    expect(base.coverage_pct).toBeGreaterThan(0);

    const denser = estimateIrrigationAssistLive(
      setAssistEmitterSpacing(zones, 15),
      80,
      20,
    );
    expect(denser.emitters).toBeGreaterThan(base.emitters);
    expect(denser.cost_aud).toBeGreaterThan(base.cost_aud);

    const longer = scaleAssistPipeRuns(zones, 1.25);
    const longerEst = estimateIrrigationAssistLive(longer, 80, 20);
    expect(longerEst.pipe_m).toBeGreaterThan(base.pipe_m);
  });

  it("nudges luminaires and live lighting estimate updates", () => {
    const placements = [
      light(),
      light({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        x_pct: 60,
        y_pct: 55,
        label: "Brass uplight",
      }),
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        symbol_id: "lomandra-mass",
        x_pct: 10,
        y_pct: 10,
        rotation_deg: 0,
        scale: 1,
        label: "Lomandra",
      },
    ];
    expect(listAssistLightingPlacements(placements)).toHaveLength(2);
    const nudged = nudgeAssistLuminaires(placements, 2, -1);
    expect(nudged[0]!.x_pct).toBe(42);
    expect(nudged[0]!.y_pct).toBe(39);
    expect(nudged[2]!.x_pct).toBe(10);

    const est = estimateLightingAssistLive(nudged, 20);
    expect(est.fixture_count).toBe(2);
    expect(est.span_m).toBeGreaterThan(0);
    expect(est.cost_aud).toBeGreaterThan(0);
    expect(assistLightingPlacementLabel("Brass uplight")).toBe(
      "Assist: Brass uplight",
    );
  });
});

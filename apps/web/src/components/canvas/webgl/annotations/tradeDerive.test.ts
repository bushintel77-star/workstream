import { describe, expect, it } from "vitest";
import { deriveTradePackModel } from "./tradeDerive";

describe("trade pack derivation", () => {
  const trenches = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "drainage" as const,
      name: "Downstream run",
      source: "traced" as const,
      depth_mm: 450,
      points: [
        { x_pct: 20, y_pct: 30 },
        { x_pct: 55, y_pct: 42 },
      ],
    },
  ];
  const zones = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Lawn north",
      kind: "spray" as const,
      emitter_spacing_cm: 30,
      emitter_flow_lph: 2.2,
      points: [
        { x_pct: 18, y_pct: 52 },
        { x_pct: 42, y_pct: 52 },
        { x_pct: 42, y_pct: 74 },
      ],
    },
  ];
  const features = [
    {
      id: "f-1",
      type: "LandscapeFeature" as const,
      metadata: {
        layer: "hardscape" as const,
        timestamp_created: new Date().toISOString(),
        source_attribution: "human_drawn" as const,
        user_modification_state: "accepted" as const,
      },
      geometry: {
        type: "Polygon" as const,
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: [
          { id: "a", pct: { x_pct: 55, y_pct: 60 } },
          { id: "b", pct: { x_pct: 76, y_pct: 60 } },
          { id: "c", pct: { x_pct: 76, y_pct: 76 } },
        ],
      },
    },
  ];
  const placements = [
    {
      id: "p-1",
      symbol_id: "led-bollard-light",
      x_pct: 68,
      y_pct: 44,
      rotation_deg: 0,
      scale: 1,
    },
  ];

  it("builds legend + trade entities for enabled packs", () => {
    const model = deriveTradePackModel({
      dialect: "architectural",
      packs: {
        irrigationDrainage: true,
        hardscapeConstruction: false,
        lightingElectrical: true,
      },
      trenches,
      zones,
      features,
      placements,
      density: "full",
    });
    expect(model.lines.some((line) => line.pack === "irrigationDrainage")).toBe(true);
    expect(model.lines.some((line) => line.pack === "lightingElectrical")).toBe(true);
    expect(model.lines.some((line) => line.pack === "hardscapeConstruction")).toBe(false);
    expect(model.legend.some((entry) => entry.pack === "irrigationDrainage")).toBe(true);
    expect(model.legend.some((entry) => entry.pack === "lightingElectrical")).toBe(true);
  });

  it("preserves code references while dialect changes phrasing", () => {
    const technical = deriveTradePackModel({
      dialect: "technical",
      packs: {
        irrigationDrainage: true,
        hardscapeConstruction: true,
        lightingElectrical: true,
      },
      trenches,
      zones,
      features,
      placements,
      density: "full",
    });
    const creative = deriveTradePackModel({
      dialect: "creative",
      packs: {
        irrigationDrainage: true,
        hardscapeConstruction: true,
        lightingElectrical: true,
      },
      trenches,
      zones,
      features,
      placements,
      density: "full",
    });
    expect(technical.lines.map((line) => line.code)).toEqual(
      creative.lines.map((line) => line.code),
    );
    expect(technical.callouts.map((callout) => callout.code)).toEqual(
      creative.callouts.map((callout) => callout.code),
    );
    expect(technical.callouts.map((callout) => callout.text)).not.toEqual(
      creative.callouts.map((callout) => callout.text),
    );
  });
});

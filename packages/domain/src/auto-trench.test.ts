import { describe, expect, it } from "vitest";
import {
  proposeAutoTrenches,
  trenchKindLabel,
  trenchLineItems,
} from "./auto-trench";

const scale = {
  metresPerXPx: 0.05,
  metresPerYPx: 0.05,
  canvasWidthPx: 400,
  canvasHeightPx: 280,
};

const zone = (id: string, kind: "drip" | "lighting", pts: [number, number][]) => ({
  id,
  name: kind === "lighting" ? "Light 1" : "Zone 1",
  kind,
  points: pts.map(([x, y]) => ({ x_pct: x, y_pct: y })),
  emitter_spacing_cm: 30,
  emitter_flow_lph: 2,
  ...(kind === "lighting" ? { fixture_spacing_m: 2.5 } : {}),
});

describe("proposeAutoTrenches", () => {
  it("proposes main + lateral from a drip zone", () => {
    const out = proposeAutoTrenches({
      zones: [
        zone("00000000-0000-4000-8000-000000000001", "drip", [
          [20, 40],
          [40, 40],
          [55, 55],
        ]),
      ],
      items: [],
      easements: [],
      services: [],
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [
        { x: 30, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 35 },
        { x: 30, y: 35 },
      ],
      scaleM: 40,
      asGhosts: true,
    });
    expect(out.some((t) => t.kind === "irrig_lateral")).toBe(true);
    expect(out.some((t) => t.kind === "irrig_main")).toBe(true);
    expect(out.every((t) => t.ghost === true)).toBe(true);
    expect(out.every((t) => t.source === "auto")).toBe(true);
    expect(out.every((t) => /^[0-9a-f-]{36}$/i.test(t.id))).toBe(true);
  });

  it("proposes lighting conduit along lighting runs", () => {
    const out = proposeAutoTrenches({
      zones: [
        zone("00000000-0000-4000-8000-000000000002", "lighting", [
          [15, 70],
          [60, 70],
        ]),
      ],
      items: [],
      easements: [],
      services: [],
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [],
      scaleM: 40,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("lighting_conduit");
    expect(out[0]!.depth_mm).toBe(300);
  });

  it("chains french drains into a drainage trench", () => {
    const out = proposeAutoTrenches({
      zones: [],
      items: [
        { id: "a", t: "frenchdrain", x: 30, y: 40 },
        { id: "b", t: "frenchdrain", x: 45, y: 55 },
      ],
      easements: [],
      services: [],
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [],
      scaleM: 40,
      asGhosts: false,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("drainage");
    expect(out[0]!.ghost).toBeUndefined();
    expect(out[0]!.points.length).toBeGreaterThanOrEqual(3);
  });

  it("nudges paths out of easement rings when possible", () => {
    const out = proposeAutoTrenches({
      zones: [
        zone("00000000-0000-4000-8000-000000000003", "drip", [
          [50, 82],
          [70, 88],
        ]),
      ],
      items: [],
      // Southern strip easement — lot centre (toward) is clear of it.
      easements: [
        [
          { x: 0, y: 70 },
          { x: 100, y: 70 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      ],
      services: [],
      boundary: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      building: [
        { x: 10, y: 10 },
        { x: 25, y: 10 },
        { x: 25, y: 25 },
        { x: 10, y: 25 },
      ],
      scaleM: 50,
      asGhosts: false,
    });
    const lateral = out.find((t) => t.kind === "irrig_lateral");
    expect(lateral).toBeTruthy();
    // Vertices should leave the southern easement strip after nudge toward lot centre.
    const cleared = lateral!.points.every((p) => p.y_pct < 70);
    expect(cleared).toBe(true);
  });
});

describe("trenchLineItems", () => {
  it("aggregates accepted trench lengths by kind", () => {
    const items = trenchLineItems(
      [
        {
          id: "00000000-0000-4000-8000-000000000010",
          name: "Main",
          kind: "irrig_main",
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 20, y_pct: 0 },
          ],
          depth_mm: 400,
          source: "auto",
        },
        {
          id: "00000000-0000-4000-8000-000000000011",
          name: "Ghost",
          kind: "irrig_main",
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 50, y_pct: 0 },
          ],
          depth_mm: 400,
          source: "auto",
          ghost: true,
        },
      ],
      scale,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("irrig_main");
    expect(items[0]!.qty).toBeCloseTo(4, 1);
    expect(items[0]!.unit).toBe("lm");
  });
});

describe("trenchKindLabel", () => {
  it("labels kinds for HUD", () => {
    expect(trenchKindLabel("lighting_conduit")).toBe("Lighting conduit");
  });
});

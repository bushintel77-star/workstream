import { describe, expect, it } from "vitest";
import {
  buildServiceLedgerRows,
  corridorFeatureId,
  resolveServiceFeatureVisual,
} from "./serviceLedger";

describe("serviceLedger", () => {
  it("builds site + design rows with stable corridor ids", () => {
    const corridor = [
      { x: 10, y: 20 },
      { x: 40, y: 20 },
    ];
    const rows = buildServiceLedgerRows({
      services: [corridor],
      easements: [
        [
          { x: 50, y: 50 },
          { x: 70, y: 50 },
          { x: 70, y: 70 },
          { x: 50, y: 70 },
        ],
      ],
      levels: [{ x: 30, y: 40, z: 42.15 }],
      irrigationZones: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Path lights",
          kind: "lighting",
          points: [
            { x_pct: 20, y_pct: 60 },
            { x_pct: 60, y_pct: 60 },
          ],
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2,
          fixture_spacing_m: 2.5,
        },
      ],
      constructionTrenches: [],
      items: [],
      scaleM: 40,
    });
    expect(rows.some((r) => r.kind === "corridor")).toBe(true);
    expect(rows.some((r) => r.kind === "easement")).toBe(true);
    expect(rows.some((r) => r.kind === "level")).toBe(true);
    expect(rows.some((r) => r.kind === "lighting")).toBe(true);
    expect(corridorFeatureId(corridor)).toBe(
      rows.find((r) => r.kind === "corridor")!.id,
    );
  });

  it("dims non-focused features and hides ticked-off ones", () => {
    expect(
      resolveServiceFeatureVisual("a", { a: true }, null).hidden,
    ).toBe(true);
    const focused = resolveServiceFeatureVisual("a", {}, ["a"]);
    const other = resolveServiceFeatureVisual("b", {}, ["a"]);
    expect(focused.opacity).toBe(1);
    expect(other.opacity).toBeLessThan(0.2);
    expect(other.hittable).toBe(false);
  });
});

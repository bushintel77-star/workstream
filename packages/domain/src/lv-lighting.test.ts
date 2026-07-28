import { describe, expect, it } from "vitest";
import {
  assessLvCircuit,
  DEFAULT_TRANSFORMER_VA,
  fixtureWattage,
  nextTransformerVa,
  polylineLengthM,
} from "./lv-lighting";

describe("lv-lighting", () => {
  it("looks up fixture watts for Curtis lighting symbols", () => {
    expect(fixtureWattage("brass-uplight")).toBe(7);
    expect(fixtureWattage("path-spike-light")).toBe(4);
    expect(fixtureWattage("olive-standard")).toBe(0);
  });

  it("enforces the 80% transformer rule with ×1.2 design load", () => {
    // 20 × 7 W = 140 W connected → 168 W design; 200 VA × 0.8 = 160 W → overload
    const fixtures = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`,
      symbolId: "brass-uplight",
      x: i,
      y: 10,
    }));
    const a = assessLvCircuit({
      fixtures,
      runLengthM: 12,
      transformerVa: DEFAULT_TRANSFORMER_VA,
      wireGauge: "12/2",
    });
    expect(a.connectedWatts).toBe(140);
    expect(a.designLoadW).toBeCloseTo(168, 5);
    expect(a.capacityW).toBe(160);
    expect(a.overloaded).toBe(true);
    expect(a.tip).toMatch(/upgrade|split/i);
  });

  it("stays under capacity for a modest path run", () => {
    const fixtures = Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      symbolId: "path-spike-light",
      x: i * 10,
      y: 50,
    }));
    const a = assessLvCircuit({
      fixtures,
      runLengthM: 8,
      transformerVa: 200,
      wireGauge: "12/2",
    });
    expect(a.overloaded).toBe(false);
    expect(a.loadFraction).toBeLessThan(1);
    expect(a.headroomW).toBeGreaterThan(0);
  });

  it("warns on high voltage drop with thin gauge", () => {
    const fixtures = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      symbolId: "brass-uplight",
      x: i,
      y: 10,
    }));
    const a = assessLvCircuit({
      fixtures,
      runLengthM: 80,
      transformerVa: 300,
      wireGauge: "14/2",
    });
    expect(a.dropWarn).toBe(true);
    expect(a.voltageDropPct).toBeGreaterThan(5);
  });

  it("measures polyline length from board % and site width", () => {
    // 50% of a 20 m board = 10 m
    const m = polylineLengthM(
      [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
      ],
      20,
    );
    expect(m).toBeCloseTo(10, 5);
  });

  it("steps transformer VA rungs", () => {
    expect(nextTransformerVa(150)).toBe(200);
    expect(nextTransformerVa(200)).toBe(300);
    expect(nextTransformerVa(300)).toBe(600);
  });
});

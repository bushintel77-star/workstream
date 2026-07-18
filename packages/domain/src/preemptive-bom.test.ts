import { describe, expect, it } from "vitest";
import type { RateCard, SpatialObject } from "@workstream/contracts";
import {
  bomTotals,
  expandPreemptiveBom,
  DEFAULT_SITE_MULTIPLIERS,
} from "./preemptive-bom";
import { assessPreemptiveRisks, RETAINING_ENGINEER_HEIGHT_M } from "./preemptive-risk";
import { spatialFingerprint } from "./spatial-facts";

const rates: RateCard[] = [];

function patio(area: number): SpatialObject {
  return {
    id: "placement:patio-1",
    layer: "hardscape",
    label: "Paver patio",
    symbol_id: "paving-bluestone",
    source: "placement",
    area_m2: area,
    length_m: Math.sqrt(area) * 4,
    depth_m: 0.25,
    volume_m3: area * 0.25,
    count: 1,
    x_pct: 40,
    y_pct: 50,
  };
}

describe("preemptive BOM", () => {
  it("expands patio into secondary and tertiary materials", () => {
    const lines = expandPreemptiveBom([patio(45)], rates, DEFAULT_SITE_MULTIPLIERS);
    const tiers = new Set(lines.map((l) => l.tier));
    expect(tiers.has("primary")).toBe(true);
    expect(tiers.has("secondary")).toBe(true);
    expect(tiers.has("tertiary")).toBe(true);
    expect(tiers.has("labour")).toBe(true);
    expect(lines.some((l) => /base/i.test(l.label))).toBe(true);
    expect(lines.some((l) => /sand/i.test(l.label))).toBe(true);
    expect(lines.some((l) => /edge/i.test(l.label))).toBe(true);
    const totals = bomTotals(lines);
    expect(totals.total).toBeGreaterThan(totals.subtotal);
  });

  it("adds engineer fee when retaining exceeds 1.2 m", () => {
    const wall: SpatialObject = {
      id: "placement:wall-1",
      layer: "structure",
      label: "Retaining wall",
      symbol_id: "retaining-wall",
      source: "placement",
      area_m2: 8,
      length_m: 10,
      height_m: RETAINING_ENGINEER_HEIGHT_M + 0.3,
      count: 1,
      x_pct: 20,
      y_pct: 30,
    };
    const lines = expandPreemptiveBom([wall], rates);
    expect(lines.some((l) => l.tier === "fee" && /engineer/i.test(l.label))).toBe(
      true,
    );
  });

  it("fingerprints change when area changes", () => {
    const a = spatialFingerprint([patio(20)]);
    const b = spatialFingerprint([patio(40)]);
    expect(a).not.toBe(b);
  });
});

describe("preemptive risk", () => {
  it("flags TRP when tree near hardscape", () => {
    const tree: SpatialObject = {
      id: "placement:tree-1",
      layer: "softscape",
      label: "Shade tree",
      symbol_id: "tree-deciduous",
      source: "placement",
      area_m2: 0,
      length_m: 0,
      count: 1,
      x_pct: 50,
      y_pct: 50,
      root_radius_m: 4,
      mature_canopy_m: 4,
    };
    const paving: SpatialObject = {
      id: "placement:pav-1",
      layer: "hardscape",
      label: "Paving",
      source: "placement",
      area_m2: 12,
      length_m: 14,
      count: 1,
      x_pct: 52,
      y_pct: 51,
    };
    const { risks, overlays } = assessPreemptiveRisks([tree, paving]);
    expect(risks.some((r) => r.kind === "trp_conflict")).toBe(true);
    expect(overlays.some((o) => o.kind === "trp_ring")).toBe(true);
  });

  it("suggests drainage when hardscape area is large", () => {
    const { risks, overlays } = assessPreemptiveRisks([patio(40)]);
    expect(risks.some((r) => r.kind === "drainage")).toBe(true);
    expect(overlays.some((o) => o.kind === "drainage")).toBe(true);
  });
});

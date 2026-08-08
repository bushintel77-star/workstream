import { describe, expect, it } from "vitest";
import type { ProjectOrchestrationWorld } from "@workstream/contracts";
import { proposeShadowAlternatives } from "./shadow-ledger";

function world(
  partial: Partial<ProjectOrchestrationWorld>,
): ProjectOrchestrationWorld {
  return {
    project_id: "00000000-0000-4000-8000-000000000001",
    fingerprint: "t",
    stale: false,
    running: false,
    updated_at: new Date().toISOString(),
    multipliers: {
      soil: "standard",
      slope: "flat",
      access: "easy",
      soil_factor: 1,
      slope_factor: 1,
      access_factor: 1,
    },
    spatial_facts: [],
    live_bom: [],
    bom_subtotal: 0,
    bom_gst: 0,
    bom_total: 0,
    risks: [],
    overlays: [],
    ...partial,
  };
}

describe("proposeShadowAlternatives", () => {
  it("returns empty when nothing material", () => {
    expect(proposeShadowAlternatives(world({}))).toEqual([]);
  });

  it("proposes solar when lighting costs exist", () => {
    const alts = proposeShadowAlternatives(
      world({
        live_bom: [
          {
            id: "l1",
            tier: "primary",
            sku: "LIGHT-1",
            label: "Path lighting",
            unit: "ea",
            qty: 8,
            rate: 220,
            total: 1760,
            source_object_ids: [],
            is_provisional: true,
          },
        ],
      }),
    );
    expect(alts.some((a) => a.id === "alt-solar-lighting")).toBe(true);
    expect(alts[0]!.save_aud).toBeGreaterThan(0);
  });

  it("proposes setback when critical risk present", () => {
    const alts = proposeShadowAlternatives(
      world({
        risks: [
          {
            id: "r1",
            kind: "retaining_height",
            severity: "critical",
            title: "Retaining wall exceeds 1.2 m",
            detail: "x",
            source_object_ids: ["w1"],
          },
        ],
      }),
    );
    expect(alts.some((a) => a.kind === "risk")).toBe(true);
  });
});

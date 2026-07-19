import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import {
  acceptProposal,
  buildHandoffCoaching,
  draftStatus,
  mapSymbolToStudioType,
  mergeAiProposals,
  proposeFromAssistQuery,
  proposeLayoutFromSnapshot,
  rejectProposal,
} from "./studioAiEngine";
import type { StudioSnapshot } from "./studioTypes";

function snapFromSeed(): StudioSnapshot {
  return {
    boundary: WRIGHTS_SEED.boundary.map((p) => ({ ...p })),
    building: WRIGHTS_SEED.building.map((p) => ({ ...p })),
    items: WRIGHTS_SEED.items
      .filter((i) => !i.ghost)
      .map((i) => ({ ...i })),
    easements: [],
    strokes: [],
    levels: [],
    services: [],
  };
}

describe("studioAiEngine", () => {
  it("maps catalog symbols into studio types", () => {
    expect(mapSymbolToStudioType("bluestone-paver")).toBe("paving");
    expect(mapSymbolToStudioType("hornbeam-pleached")).toBe("hedge");
    expect(mapSymbolToStudioType("french-drain-line")).toBe("frenchdrain");
  });

  it("proposes layout ghosts from live geometry", () => {
    const { items } = proposeLayoutFromSnapshot(
      snapFromSeed(),
      "12 Wrights Terrace, Prahran VIC 3181",
      10,
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.ghost && i.id.startsWith("ai-layout-"))).toBe(
      true,
    );
  });

  it("assist query for shade yields canopy ghosts", () => {
    const { items } = proposeFromAssistQuery(
      snapFromSeed(),
      "shade the west glazing",
      20,
    );
    expect(items.some((i) => i.t === "canopy")).toBe(true);
    expect(items[0]?.why).toMatch(/shade/i);
  });

  it("coaching prioritises pending review when ghosts exist", () => {
    const coaching = buildHandoffCoaching(snapFromSeed(), "12 Wrights Terrace, Prahran", 3);
    expect(coaching[0]?.id).toBe("review-ghosts");
  });

  it("draft status tracks pending and busy states", () => {
    expect(draftStatus(2, "idle")).toBe("unverified");
    expect(draftStatus(0, "idle")).toBe("verified");
    expect(draftStatus(0, "scanning")).toBe("scanning");
  });

  it("accept / reject mutate only the targeted proposal", () => {
    const base = snapFromSeed();
    const { items } = proposeLayoutFromSnapshot(
      base,
      "12 Wrights Terrace, Prahran",
      1,
    );
    const withGhosts = { ...base, items: [...base.items, ...items] };
    const id = items[0]!.id;
    const accepted = acceptProposal(withGhosts, id);
    expect(accepted.items.find((i) => i.id === id)?.ghost).toBe(false);
    const rejected = rejectProposal(withGhosts, id);
    expect(rejected.items.some((i) => i.id === id)).toBe(false);
  });

  it("merge replaces layout proposals without wiping unrelated ghosts", () => {
    const base = snapFromSeed();
    const canopy = {
      id: "ai-canopy-1",
      t: "canopy" as const,
      x: 10,
      y: 10,
      rot: 0,
      scale: 1,
      ghost: true,
      why: "aerial",
      conf: 0.7,
    };
    const first = proposeLayoutFromSnapshot(base, "12 Wrights Terrace, Prahran", 1);
    const mergedOnce = mergeAiProposals(
      { ...base, items: [...base.items, canopy] },
      first.items,
      ["layout"],
    );
    expect(mergedOnce.some((i) => i.id === "ai-canopy-1")).toBe(true);
    expect(mergedOnce.filter((i) => i.id.startsWith("ai-layout-")).length).toBe(
      first.items.length,
    );
  });
});

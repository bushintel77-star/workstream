import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../studioCatalog";
import {
  acceptProposal,
  buildHandoffCoaching,
  catalogSymbolStudioType,
  draftStatus,
  isCanopyLikeSuggestion,
  mapSymbolToStudioType,
  mergeAiProposals,
  proposeFromAssistQuery,
  proposeFromCanopyImage,
  proposeFromStrokes,
  proposeLayoutFromSnapshot,
  proposalToStudioItem,
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
    drainageRuns: [],
    pathCorridors: [],
    services: [],
    bydaAssets: [],
    keylessOverlays: [],
    irrigationZones: [],
    constructionTrenches: [],
    annotations: [],
    imageLayers: [],
  };
}

describe("studioAiEngine", () => {
  it("maps catalog symbols into studio types", () => {
    expect(mapSymbolToStudioType("bluestone-paver")).toBe("paving");
    expect(mapSymbolToStudioType("hornbeam-pleached")).toBe("hedge");
    expect(mapSymbolToStudioType("french-drain-line")).toBe("frenchdrain");
  });

  it("maps every size-ladder rung explicitly, not by keyword luck", () => {
    expect(mapSymbolToStudioType("curtis-tree-780")).toBe("canopy");
    expect(mapSymbolToStudioType("curtis-tree-690")).toBe("canopy");
    expect(mapSymbolToStudioType("curtis-tree-500")).toBe("feature");
    expect(mapSymbolToStudioType("curtis-tree-350")).toBe("feature");
    expect(mapSymbolToStudioType("curtis-hedge-180")).toBe("hedge");
    expect(mapSymbolToStudioType("curtis-hedge-140")).toBe("hedge");
    expect(mapSymbolToStudioType("curtis-hedge-120")).toBe("hedge");
    expect(mapSymbolToStudioType("curtis-hedge-090")).toBe("hedge");
    expect(mapSymbolToStudioType("curtis-deck-050")).toBe("deck");
  });

  /**
   * Full-catalog hydrate: before the catalog pass these all fell through the
   * id-keyword chain onto the blanket `canopy` default, so a persisted
   * porcelain tile or a mondo-grass edge rehydrated as a six-metre tree.
   */
  it("resolves non-curated catalog symbols from the real catalog record", () => {
    expect(mapSymbolToStudioType("porcelain-tile")).toBe("paving");
    expect(mapSymbolToStudioType("gravel-mulch")).toBe("paving");
    expect(mapSymbolToStudioType("temaki-kerb-raised")).toBe("paving");
    expect(mapSymbolToStudioType("timber-deck")).toBe("deck");
    expect(mapSymbolToStudioType("mondo-edge")).toBe("bed");
    expect(mapSymbolToStudioType("dichondra-carpet")).toBe("bed");
    expect(mapSymbolToStudioType("boston-ivy")).toBe("bed");
    expect(mapSymbolToStudioType("correa-shrub")).toBe("hedge");
    expect(mapSymbolToStudioType("box-ball")).toBe("hedge");
    expect(mapSymbolToStudioType("pyrus-capital")).toBe("canopy");
    expect(mapSymbolToStudioType("osmic-nature-tree-deciduous")).toBe("canopy");
    expect(mapSymbolToStudioType("magnolia-little-gem")).toBe("feature");
  });

  it("reads the id before the pack keyword tail (temaki appends both tags)", () => {
    // Every temaki plant carries "shrub" AND "groundcover" in its keywords;
    // only the id separates an ornamental grass from a shrub.
    expect(catalogSymbolStudioType("temaki-grass")).toBe("bed");
    expect(catalogSymbolStudioType("temaki-shrub")).toBe("hedge");
    expect(catalogSymbolStudioType("temaki-tree-broadleaved")).toBe("canopy");
    expect(catalogSymbolStudioType("temaki-lawn")).toBe("lawn");
  });

  it("declines symbols the catalog cannot class, leaving the coarse chain", () => {
    // Structure / water / furniture / lighting / planning glyphs.
    expect(catalogSymbolStudioType("pergola")).toBeNull();
    expect(catalogSymbolStudioType("pool")).toBeNull();
    expect(catalogSymbolStudioType("planzv-parkanlage")).toBeNull();
    expect(catalogSymbolStudioType("not-a-catalog-symbol")).toBeNull();
    // The coarse keyword chain still answers for them (unchanged behaviour).
    expect(mapSymbolToStudioType("brass-uplight")).toBe("feature");
    expect(mapSymbolToStudioType("french-drain-line")).toBe("frenchdrain");
  });

  it("ghosts carry the proposed symbol height so accept does not resize", () => {
    const ghost = proposalToStudioItem(
      {
        id: "g1",
        symbol_id: "hornbeam-pleached",
        x_pct: 40,
        y_pct: 50,
        confidence: 0.9,
        reason: "Screen to north boundary",
      },
      "ai-assist-1",
      "assist",
    );
    expect(ghost.symbolId).toBe("hornbeam-pleached");
    expect(ghost.heightM).toBe(3.5);
    expect(ghost.ghost).toBe(true);
  });

  it("never puts a non-catalog proposal id on the item", () => {
    const ghost = proposalToStudioItem(
      {
        id: "g2",
        symbol_id: "canopy",
        x_pct: 40,
        y_pct: 50,
        confidence: 0.8,
        reason: "Shade",
      },
      "ai-canopy-1",
      "canopy",
    );
    // "canopy" is a coarse type hint, not a catalog symbol — must not persist.
    expect(ghost.symbolId).toBeUndefined();
    expect(ghost.heightM).toBeUndefined();
    expect(ghost.t).toBe("canopy");
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

  it("sketch strokes become site-anchored CAD ghosts", () => {
    const base = snapFromSeed();
    const withInk: StudioSnapshot = {
      ...base,
      strokes: [
        {
          id: "sk-deck",
          points: [
            { x: 40, y: 58 },
            { x: 58, y: 58 },
            { x: 58, y: 74 },
            { x: 40, y: 74 },
            { x: 41, y: 59 },
          ],
        },
        {
          id: "sk-canopy",
          points: [
            { x: 28, y: 62 },
            { x: 30, y: 63 },
            { x: 29, y: 65 },
          ],
        },
      ],
    };
    const { items, count } = proposeFromStrokes(withInk, 50);
    expect(count).toBe(2);
    expect(items.every((i) => i.ghost && i.id.startsWith("ai-sketch-"))).toBe(
      true,
    );
    expect(items.some((i) => i.t === "deck" || i.t === "bed" || i.t === "lawn")).toBe(
      true,
    );
    expect(items.some((i) => i.t === "canopy" || i.t === "feature")).toBe(true);
    expect(items.every((i) => i.x >= 0 && i.x <= 100 && i.y >= 0 && i.y <= 100)).toBe(
      true,
    );
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

  it("classifies canopy-like vision symbols", () => {
    expect(isCanopyLikeSuggestion("canopy")).toBe(true);
    expect(isCanopyLikeSuggestion("existing-tree-retain")).toBe(true);
    expect(isCanopyLikeSuggestion("bluestone-paver")).toBe(false);
  });

  it("prefers non-empty vision clusters over colour heuristic (P2.1)", () => {
    // Blank image — heuristic would find nothing; API clusters must win.
    const blank = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
    };
    const { items, source } = proposeFromCanopyImage(blank, 0, [
      {
        id: "vision-1",
        symbol_id: "canopy",
        x_pct: 33,
        y_pct: 44,
        confidence: 0.91,
        reason: "Vision canopy cluster",
      },
    ]);
    expect(source).toBe("vision");
    expect(items).toHaveLength(1);
    expect(items[0]?.x).toBe(33);
    expect(items[0]?.y).toBe(44);
    expect(items[0]?.ghost).toBe(true);
    expect(items[0]?.why).toMatch(/vision/i);
  });

  it("falls back to colour heuristic when vision clusters are empty", () => {
    const size = 48;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = 40;
      data[i * 4 + 1] = 40;
      data[i * 4 + 2] = 40;
      data[i * 4 + 3] = 255;
    }
    for (let y = 2; y < 18; y++) {
      for (let x = 2; x < 18; x++) {
        const i = (y * size + x) * 4;
        data[i] = 40;
        data[i + 1] = 140;
        data[i + 2] = 50;
      }
    }
    const { items, source } = proposeFromCanopyImage(
      { width: size, height: size, data },
      0,
      [],
    );
    expect(source).toBe("heuristic");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.ghost)).toBe(true);
  });

  it("stamps the canopy source on every proposal so it survives acceptance", () => {
    const blank = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
    };
    const { items } = proposeFromCanopyImage(blank, 0, [
      {
        id: "vision-1",
        symbol_id: "canopy",
        x_pct: 33,
        y_pct: 44,
        confidence: 0.91,
        reason: "Vision canopy cluster",
      },
    ]);
    expect(items.every((i) => i.source === "canopy")).toBe(true);
  });

  it("folds the aerial capture date into the canopy reason", () => {
    const blank = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
    };
    const { items } = proposeFromCanopyImage(
      blank,
      0,
      [
        {
          id: "vision-1",
          symbol_id: "canopy",
          x_pct: 33,
          y_pct: 44,
          confidence: 0.91,
          reason: "Detected canopy from aerial imagery",
        },
      ],
      "2023",
    );
    expect(items[0]!.why).toMatch(/2023 imagery/);
    expect(items[0]!.why).not.toMatch(/aerial imagery$/);
  });

  it("leaves the reason undated when no capture date is known", () => {
    const blank = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
    };
    const { items } = proposeFromCanopyImage(blank, 0, [
      {
        id: "vision-1",
        symbol_id: "canopy",
        x_pct: 33,
        y_pct: 44,
        confidence: 0.91,
        reason: "Detected canopy from aerial imagery",
      },
    ]);
    expect(items[0]!.why).toBe("Detected canopy from aerial imagery");
  });
});

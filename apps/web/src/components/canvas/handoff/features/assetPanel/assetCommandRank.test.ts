import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  categoryForStudioType,
  pushRecentAssetType,
  rankAssetCommands,
  RECENT_ASSET_CAP,
  STUDIO_TYPE_SKUS,
} from "./assetCommandRank";

function loadRateCardSkus(): Set<string> {
  const path = resolve(
    process.cwd(),
    "packages/domain/src/seed/rate-card.json",
  );
  const rows = JSON.parse(readFileSync(path, "utf8")) as Array<{ sku: string }>;
  return new Set(rows.map((r) => r.sku));
}

describe("assetCommandRank", () => {
  it("ranks exact SKU above name substring", () => {
    const ranked = rankAssetCommands({
      query: "PAV-BLUE-SAWN",
      mode: "cad",
      recents: ["lawn"],
    });
    expect(ranked[0]).toBe("paving");
  });

  it("every STUDIO_TYPE_SKUS entry resolves to a seed rate-card SKU", () => {
    const rateSkus = loadRateCardSkus();
    for (const [type, skus] of Object.entries(STUDIO_TYPE_SKUS)) {
      expect(skus.length).toBeGreaterThan(0);
      for (const sku of skus) {
        expect(rateSkus.has(sku), `${type} → ${sku}`).toBe(true);
      }
    }
  });

  it("ranks name prefix ahead of loose substring", () => {
    const ranked = rankAssetCommands({
      query: "blue",
      mode: "cad",
    });
    expect(ranked[0]).toBe("paving");
    expect(ranked).toContain("paving");
  });

  it("boosts planting types in sketch mode when query is empty", () => {
    const ranked = rankAssetCommands({
      query: "",
      mode: "sketch",
      recents: [],
    });
    const planting = new Set(["canopy", "feature", "lawn", "hedge", "bed"]);
    expect(planting.has(ranked[0]!)).toBe(true);
  });

  it("surfaces recents ahead of peers when query is empty", () => {
    const ranked = rankAssetCommands({
      query: "",
      mode: "cad",
      recents: ["frenchdrain", "deck"],
    });
    expect(ranked[0]).toBe("frenchdrain");
    expect(ranked[1]).toBe("deck");
  });

  it("pushRecentAssetType dedupes and caps", () => {
    let recents = pushRecentAssetType([], "lawn");
    recents = pushRecentAssetType(recents, "bed");
    recents = pushRecentAssetType(recents, "lawn");
    expect(recents[0]).toBe("lawn");
    expect(recents).toEqual(["lawn", "bed"]);
    for (let i = 0; i < 12; i += 1) {
      recents = pushRecentAssetType(recents, i % 2 === 0 ? "canopy" : "hedge");
    }
    expect(recents.length).toBeLessThanOrEqual(RECENT_ASSET_CAP);
  });

  it("maps studio types to ranking categories", () => {
    expect(categoryForStudioType("hedge")).toBe("planting");
    expect(categoryForStudioType("paving")).toBe("paving");
    expect(categoryForStudioType("frenchdrain")).toBe("drainage");
  });

  it("excludes existing-only types by default", () => {
    const ranked = rankAssetCommands({ query: "exist", mode: "survey" });
    expect(ranked).not.toContain("exist");
  });
});

import { describe, expect, it } from "vitest";
import { searchTitleParcelByAddress } from "./vicmap-title-search";

/**
 * LIVE proof of the address-keyed title search (read-only WFS GETs), gated
 * behind VICMAP_LIVE=1. This is the tripwire that "address → property keys
 * → parcel polygon" resolves the way a title search does — deterministic,
 * never a pin-containment gamble.
 *
 *   VICMAP_LIVE=1 pnpm exec vitest run apps/api/src/lib/vicmap-title-search.live.test.ts
 */
const live = process.env.VICMAP_LIVE === "1";

describe.skipIf(!live)("vicmap keyed title search (live)", () => {
  it("resolves a Toorak title parcel from the address alone", async () => {
    const hit = await searchTitleParcelByAddress("10 Hopetoun Road Toorak VIC 3142");
    expect(hit).not.toBeNull();
    expect(hit!.eziAddress).toContain("10 HOPETOUN ROAD");
    expect(hit!.polygon.coordinates[0]!.length).toBeGreaterThanOrEqual(4);
    expect(hit!.attrs.pfi).toBeTruthy();
    expect(hit!.matchType).toBe("exact");
  });

  it("resolves an outer-suburb parcel (Healesville)", async () => {
    const hit = await searchTitleParcelByAddress("23 Thomas Road Healesville");
    expect(hit).not.toBeNull();
    expect(hit!.polygon.coordinates[0]!.length).toBeGreaterThanOrEqual(4);
  });
});

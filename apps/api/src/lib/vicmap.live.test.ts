import { describe, expect, it } from "vitest";
import {
  fetchTitleParcel,
  fetchBuildingPolygon,
  fetchEasementLinesForTitle,
  fetchNeighbourBuildingPolygons,
  fetchUrbanTreePointsForTitle,
} from "./vicmap";

/**
 * LIVE smoke test for the Vicmap ground-truth pipeline (read-only WFS GETs).
 *
 * Gated behind `VICMAP_LIVE=1` so normal CI never hits the public GeoServer.
 * Run on demand (and in the weekly audit) to prove the title-hydrate source is
 * reachable and still returns sane cadastral data:
 *
 *   VICMAP_LIVE=1 pnpm exec vitest run apps/api/src/lib/vicmap.live.test.ts
 *
 * Ground-truth rule: this is the tripwire that the "never invent a seed lot"
 * guarantee still has a real source behind it.
 */
const live = process.env.VICMAP_LIVE === "1";

// Hawthorn East residential point — confirmed parcel hit (2026-08-17).
const LAT = -37.8601;
const LNG = 145.0848;

describe.skipIf(!live)("vicmap live hydrate", () => {
  it("fetches a sane cadastral title parcel at a real point", async () => {
    const parcel = await fetchTitleParcel(LAT, LNG);
    expect(parcel).not.toBeNull();
    const ring = parcel!.polygon.coordinates[0];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(parcel!.attrs.lotAreaM2).toBeGreaterThan(50);
    expect(parcel!.attrs.lotAreaM2).toBeLessThan(5000);
  });

  it("hydrates dwelling, easements, urban trees and neighbours without throwing", async () => {
    const parcel = await fetchTitleParcel(LAT, LNG);
    expect(parcel).not.toBeNull();
    const ring = parcel!.polygon.coordinates[0] as [number, number][];

    // Each fetch must resolve (empty is fine — Vicmap data availability varies
    // by suburb); a throw means the discovery/CQL layer broke and needs fixing.
    const house = await fetchBuildingPolygon(ring);
    const easements = await fetchEasementLinesForTitle(ring);
    const trees = await fetchUrbanTreePointsForTitle(ring);
    const neighbours = await fetchNeighbourBuildingPolygons(ring);

    expect(Array.isArray(easements)).toBe(true);
    expect(Array.isArray(trees)).toBe(true);
    expect(Array.isArray(neighbours)).toBe(true);
    if (house) {
      expect(house.coordinates[0].length).toBeGreaterThanOrEqual(4);
    }
  });
});

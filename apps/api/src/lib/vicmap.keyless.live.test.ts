import { describe, expect, it } from "vitest";
import { fetchKeylessRings } from "./vicmap";

/**
 * LIVE smoke test for the council/KEYLESS overlay hydrate (read-only WFS GETs).
 *
 * Gated behind `VICMAP_LIVE=1` so normal CI never hits the public GeoServer.
 * Run on demand (and in the weekly audit) to prove Screen 1's ground-truth set
 * — planning zones, heritage overlays, contours — still resolves from the real
 * Vicmap WFS:
 *
 *   VICMAP_LIVE=1 pnpm exec vitest run apps/api/src/lib/vicmap.keyless.live.test.ts
 *
 * Regression guard: the scorers must pick plan_zone / plan_overlay / el_contour
 * (not the point heritage_inventory or the flood-history layer), and contours
 * must be queried with a BBOX window, not a point INTERSECTS.
 */
const live = process.env.VICMAP_LIVE === "1";

// Hawthorn East residential point — in HCTZ2 zone + HO841 heritage overlay
// (confirmed live 2026-08-17).
const LAT = -37.8289;
const LNG = 145.0456;

describe.skipIf(!live)("vicmap keyless council overlays live", () => {
  it("hydrates a real planning zone ring with a zone label", async () => {
    const hit = await fetchKeylessRings("planning", LAT, LNG);
    expect(hit).not.toBeNull();
    expect(hit!.typeName).toContain("plan_zone");
    expect(hit!.rings.length).toBeGreaterThanOrEqual(1);
    expect(hit!.label).toBeTruthy();
  });

  it("hydrates the heritage overlay ring (HO) from plan_overlay", async () => {
    const hit = await fetchKeylessRings("heritage", LAT, LNG);
    expect(hit).not.toBeNull();
    expect(hit!.typeName).toContain("plan_overlay");
    expect(hit!.rings.length).toBeGreaterThanOrEqual(1);
    expect(hit!.label).toMatch(/^HO/i);
  });

  it("returns contour lines with elevations via the BBOX query", async () => {
    const hit = await fetchKeylessRings("contour", LAT, LNG);
    expect(hit).not.toBeNull();
    expect(hit!.rings.length).toBeGreaterThanOrEqual(1);
    // Elevation attribute (altitude) must flow through for derived levels.
    expect(hit!.elevations?.some((e) => e != null)).toBe(true);
  });

  it("still hydrates water-corp authority rings", async () => {
    const hit = await fetchKeylessRings("water_corp", LAT, LNG);
    expect(hit).not.toBeNull();
    expect(hit!.rings.length).toBeGreaterThanOrEqual(1);
  });
});

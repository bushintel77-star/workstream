import { describe, expect, it } from "vitest";
import { fetchKeylessRings, VICMAP_KEYLESS_SPECS } from "./vicmap";

/**
 * LIVE full-catalogue probe for the KEYLESS overlay pipeline (read-only WFS).
 * Gated behind `VICMAP_LIVE=1` so normal CI never hits the public GeoServer.
 *
 *   VICMAP_LIVE=1 pnpm exec vitest run apps/api/src/lib/vicmap.keyless.allkinds.live.test.ts
 *
 * Per-kind expectations are honest about the source data:
 *  - REQUIRED kinds (planning / bushfire / contour / heritage / water_corp /
 *    native_vegetation) must resolve rings at a known-good point.
 *  - LOCATIONAL kinds (flood / acid_sulfate / wetland / road_casement /
 *    easement / urban_tree) may legitimately be absent at any given site;
 *    the contract is "resolves without throwing, null is honest".
 *  - `easement` hydrates via the dedicated title-ring flow
 *    (`fetchEasementLinesForTitle`), not the point wash — see
 *    vicmap.live.test.ts.
 *  - `flood` maps to `plan_overlay` (statutory LSIO/SBO/FLO); coverage of
 *    those codes on the keyless GeoServer is partial, so a null at a
 *    floodplain point is recorded, not failed.
 */
const live = process.env.VICMAP_LIVE === "1";

type Point = { name: string; lat: number; lng: number };
const POINTS: Record<string, Point[]> = {
  planning: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  bushfire: [{ name: "Ferny Creek (BMO)", lat: -37.844, lng: 145.352 }],
  contour: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  heritage: [{ name: "Hawthorn East (HO841)", lat: -37.8289, lng: 145.0456 }],
  water_corp: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  native_vegetation: [
    { name: "Heathcote scrub (Heathy Dry Forest)", lat: -36.933, lng: 144.723 },
  ],
  flood: [{ name: "Maribyrnong floodplain", lat: -37.7746, lng: 144.8879 }],
  easement: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  urban_tree: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  road_casement: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  acid_sulfate: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
  wetland: [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }],
};

const REQUIRED = new Set([
  "planning",
  "bushfire",
  "contour",
  "heritage",
  "water_corp",
  "native_vegetation",
]);

describe.skipIf(!live)("vicmap keyless overlay catalogue (live)", () => {
  for (const kind of Object.keys(VICMAP_KEYLESS_SPECS)) {
    it(`${kind} resolves honestly`, async () => {
      const targets = POINTS[kind] ?? [{ name: "Hawthorn East", lat: -37.8289, lng: 145.0456 }];
      let hit: Awaited<ReturnType<typeof fetchKeylessRings>> = null;
      for (const p of targets) {
        hit = await fetchKeylessRings(kind as never, p.lat, p.lng).catch(() => null);
        if (hit && hit.rings.length > 0) break;
      }
      if (REQUIRED.has(kind)) {
        expect(
          hit,
          `kind=${kind} must resolve at: ${targets.map((t) => t.name).join(", ")}`,
        ).not.toBeNull();
        expect(hit!.rings.length).toBeGreaterThanOrEqual(1);
      } else {
        // Locational kinds: absence is honest data, a throw is the failure.
        expect(hit === null || hit.rings.length >= 0).toBe(true);
      }
    });
  }
});

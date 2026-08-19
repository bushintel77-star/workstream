import { describe, expect, it } from "vitest";
import { searchVicmapAddresses } from "./vicmap-address";

// Live-tolerant: the keyless GNAF WFS is a government service; a clean
// empty/throw fallback is honest, but a success MUST return Victorian
// addresses with coordinates.
describe.skipIf(process.env.VICMAP_LIVE !== "1")("vicmap-address (live)", () => {
  it("resolves Victorian GNAF suggestions with coordinates", async () => {
    const hits = await searchVicmapAddresses("Armadale", 6);
    if (hits.length === 0) return; // upstream unreachable — honest null
    expect(hits[0]!.text).toMatch(/ARMADALE|Armadale/i);
    expect(Number.isFinite(hits[0]!.lat)).toBe(true);
    expect(Number.isFinite(hits[0]!.lng)).toBe(true);
  });

  it("finds a specific street", async () => {
    const hits = await searchVicmapAddresses("Wrights Terrace", 6);
    if (hits.length === 0) return;
    expect(hits.some((h) => /WRIGHTS TERRACE/i.test(h.text))).toBe(true);
  });
});

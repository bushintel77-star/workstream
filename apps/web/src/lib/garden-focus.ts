/** Focus the design camera on the garden, not the whole black map / house. */

export type LngLat = [number, number];

function openRing(ring: LngLat[]): LngLat[] {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

function centroid(ring: LngLat[]): { lng: number; lat: number } {
  const pts = openRing(ring);
  if (!pts.length) return { lng: 0, lat: 0 };
  return {
    lng: pts.reduce((s, c) => s + c[0], 0) / pts.length,
    lat: pts.reduce((s, c) => s + c[1], 0) / pts.length,
  };
}

/**
 * Ring used to fit the camera: prefer the outdoor side of the lot
 * (vertices farthest from the house), falling back to the full title.
 */
export function gardenFocusRing(
  lotRing: LngLat[],
  houseRing: LngLat[] = [],
): LngLat[] {
  const lot = openRing(lotRing);
  const house = openRing(houseRing);
  if (lot.length < 3) return lot;
  if (house.length < 3) return lot;

  const hc = centroid(house);
  const scored = lot.map(([lng, lat]) => ({
    lng,
    lat,
    d: Math.hypot(lng - hc.lng, lat - hc.lat),
  }));
  scored.sort((a, b) => b.d - a.d);

  // Keep the farther ~65% of title vertices — that's usually the backyard garden.
  const keep = Math.max(3, Math.ceil(scored.length * 0.65));
  const far = scored.slice(0, keep);
  if (far.length < 3) return lot;

  // Rebuild a ring in original lot order so bounds stay sensible.
  const farSet = new Set(far.map((p) => `${p.lng},${p.lat}`));
  const ordered = lot.filter(([lng, lat]) => farSet.has(`${lng},${lat}`));
  return ordered.length >= 3 ? ordered : far.map((p) => [p.lng, p.lat] as LngLat);
}

/** Approximate garden ground span (m) for scale bar — prefer garden area side length. */
export function gardenSpanMetres(
  gardenAreaM2: number | null | undefined,
  lotWidthM: number | null | undefined,
): number | null {
  if (gardenAreaM2 != null && gardenAreaM2 > 0) {
    return Math.sqrt(gardenAreaM2);
  }
  if (lotWidthM != null && lotWidthM > 0) return lotWidthM * 0.55;
  return null;
}

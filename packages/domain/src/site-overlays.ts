/** Indicative site-intelligence overlays (Workflow 1 — not survey grade). */

export type EasementCorridor = {
  id: string;
  label: string;
  /** GeoJSON-style ring [lng, lat][] — closed. */
  ring: [number, number][];
};

type LngLat = [number, number];

function ringBounds(ring: LngLat[]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** Phase-1 drainage easement strip along the southern lot edge (indicative). */
export function buildIndicativeEasements(lotRing: LngLat[]): EasementCorridor[] {
  if (lotRing.length < 4) return [];

  const { minLng, maxLng, minLat, maxLat } = ringBounds(lotRing);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  if (latSpan <= 0 || lngSpan <= 0) return [];

  const insetLng = lngSpan * 0.06;
  const depth = latSpan * 0.1;

  const ring: LngLat[] = [
    [minLng + insetLng, minLat + depth * 0.15],
    [maxLng - insetLng, minLat + depth * 0.15],
    [maxLng - insetLng, minLat + depth],
    [minLng + insetLng, minLat + depth],
    [minLng + insetLng, minLat + depth * 0.15],
  ];

  return [
    {
      id: "easement-drainage",
      label: "Drainage easement",
      ring,
    },
  ];
}

/** Ray-casting point-in-polygon for easement soft warnings. */
export function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInEasement(
  lng: number,
  lat: number,
  easements: EasementCorridor[],
): EasementCorridor | null {
  for (const e of easements) {
    if (pointInRing(lng, lat, e.ring)) return e;
  }
  return null;
}

/** Shoelace formula for polygon area in m². */
// TODO: implement with proper coordinate projection (Phase 2)
export function polygonArea(coords: [number, number][]): number {
  return 0;
}

/** Sum of edge lengths using Haversine distance. */
// TODO: implement Haversine per-edge (Phase 2)
export function polygonPerimeter(coords: [number, number][]): number {
  return 0;
}

/** Per-edge length (m) and bearing (degrees). */
// TODO: implement (Phase 2)
export function edgeLengths(
  coords: [number, number][],
): { length_m: number; bearing_deg: number }[] {
  return [];
}

/** Polygon difference: garden = title boundary − house footprint. */
// TODO: implement polygon clipping (Phase 2)
export function subtractPolygon(
  outer: [number, number][],
  inner: [number, number][],
): [number, number][] {
  return outer;
}

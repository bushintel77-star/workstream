/** Lot-metre TPZ / NRZ circle for MapLibre / sheet overlays. */

import { nrzRadiusFromDbhCm } from "./as4970-protection-zones";

export type TpzCircle = {
  id: string;
  x_m: number;
  y_m: number;
  radius_m: number;
  label?: string;
};

export type TpzPctAnchor = {
  id: string;
  x_pct: number;
  y_pct: number;
  radius_m: number;
  label?: string;
};

/** Convert percent-space anchors into lot-metre circles (SW origin, Y-up). */
export function tpzCirclesFromPctAnchors(
  anchors: TpzPctAnchor[],
  widthM: number,
  heightM: number,
): TpzCircle[] {
  if (widthM <= 0 || heightM <= 0) return [];
  return anchors
    .filter((a) => a.radius_m > 0)
    .map((a) => ({
      id: a.id,
      x_m: (a.x_pct / 100) * widthM,
      y_m: (1 - a.y_pct / 100) * heightM,
      radius_m: a.radius_m,
      label: a.label,
    }));
}

/**
 * AS 4970-2025 NRZ radius from DBH (cm) — legacy TPZ name kept for callers.
 * R = clamp(12 × DBH(m), 2 m, 15 m).
 */
export function tpzRadiusFromDbhCm(dbhCm: number): number {
  return nrzRadiusFromDbhCm(dbhCm);
}

/** Approximate a circle as a closed lng/lat ring around a centre. */
export function circleRingLngLat(
  center: { lng: number; lat: number },
  radiusM: number,
  segments = 32,
): [number, number][] {
  if (radiusM <= 0) return [];
  const mPerLat = 110_540;
  const mPerLng = 110_540 * Math.cos((center.lat * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([
      center.lng + (Math.cos(a) * radiusM) / mPerLng,
      center.lat + (Math.sin(a) * radiusM) / mPerLat,
    ]);
  }
  return ring;
}

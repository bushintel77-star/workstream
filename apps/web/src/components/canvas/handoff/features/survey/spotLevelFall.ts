import type { SpotLevel } from "../../studioCatalog";

export type SpotLevelFall = {
  high: SpotLevel;
  low: SpotLevel;
  distanceM: number;
  deltaMm: number;
  fallPct: number;
  flat: boolean;
};

/** Build a downhill set-out cue between two authored spot levels. */
export function buildSpotLevelFall(
  a: SpotLevel,
  b: SpotLevel,
  scaleM: number,
): SpotLevelFall | null {
  const distanceM = (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
  if (!Number.isFinite(distanceM) || distanceM < 0.2) return null;
  const high = a.z >= b.z ? a : b;
  const low = high === a ? b : a;
  const deltaM = Math.abs(high.z - low.z);
  return {
    high,
    low,
    distanceM,
    deltaMm: Math.round(deltaM * 1000),
    fallPct: +((deltaM / distanceM) * 100).toFixed(1),
    flat: deltaM < 0.0005,
  };
}

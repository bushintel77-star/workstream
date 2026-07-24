/**
 * Indicative drainage runs between spot RLs (Workflow 1).
 * No TIN / cut-fill — explicit operator-authored links only.
 */

export type DrainageLevelPt = {
  x: number;
  y: number;
  z: number;
};

export type DrainageRun = {
  id: string;
  /** Ordered downhill-ish points (may be re-sorted by RL). */
  points: DrainageLevelPt[];
  source: "indicative";
};

export type DrainageFallCue = {
  from: DrainageLevelPt;
  to: DrainageLevelPt;
  distanceM: number;
  fallPct: number;
  adverse: boolean;
};

export function sortRunDownhill(points: DrainageLevelPt[]): DrainageLevelPt[] {
  if (points.length < 2) return [...points];
  // Prefer highest → lowest RL so arrows read as fall.
  const byZ = [...points].sort((a, b) => b.z - a.z);
  return byZ;
}

export function buildDrainageFallCues(
  run: DrainageRun,
  scaleM: number,
): DrainageFallCue[] {
  const pts = sortRunDownhill(run.points);
  const cues: DrainageFallCue[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const distanceM = (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
    if (distanceM < 0.2) continue;
    const deltaM = a.z - b.z;
    const fallPct = +((Math.abs(deltaM) / distanceM) * 100).toFixed(1);
    cues.push({
      from: a,
      to: b,
      distanceM,
      fallPct,
      adverse: deltaM < -0.001, // after sort, negative means climb
    });
  }
  return cues;
}

/** Build a run from selected spot levels (min 2). */
export function makeIndicativeDrainageRun(
  levels: DrainageLevelPt[],
  id = cryptoRandomId(),
): DrainageRun | null {
  if (levels.length < 2) return null;
  return {
    id,
    points: sortRunDownhill(levels),
    source: "indicative",
  };
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `drain-${Date.now()}`;
}

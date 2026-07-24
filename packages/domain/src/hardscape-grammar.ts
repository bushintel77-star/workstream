/**
 * Residential hardscape grammar — path widths + edge types (Workflow 1).
 * Not Civil 3D: locked residential modules, not hydraulic design.
 */

export const PATH_WIDTH_LOCKS_M = [0.9, 1.2, 1.5, 1.8] as const;
export type PathWidthLockM = (typeof PATH_WIDTH_LOCKS_M)[number];

export const HARDSCAPE_EDGE_TYPES = [
  "sawn",
  "soldier",
  "spalled",
  "soft",
] as const;
export type HardscapeEdgeType = (typeof HARDSCAPE_EDGE_TYPES)[number];

export const HARDSCAPE_EDGE_LABELS: Record<HardscapeEdgeType, string> = {
  sawn: "Sawn",
  soldier: "Soldier",
  spalled: "Spalled",
  soft: "Soft edge",
};

export function isPathWidthLockM(n: number): n is PathWidthLockM {
  return (PATH_WIDTH_LOCKS_M as readonly number[]).includes(n);
}

export function snapPathWidthM(n: number): PathWidthLockM {
  if (!Number.isFinite(n) || n <= 0) return 1.2;
  let best: PathWidthLockM = 1.2;
  let bestD = Infinity;
  for (const w of PATH_WIDTH_LOCKS_M) {
    const d = Math.abs(w - n);
    if (d < bestD) {
      best = w;
      bestD = d;
    }
  }
  return best;
}

/** Visual scale factor for paving/deck glyphs from locked width (1.2 m = 1). */
export function pathWidthToGlyphScale(widthM: PathWidthLockM): number {
  return Math.max(0.65, Math.min(1.35, widthM / 1.2));
}

/** Residential corner fillet locks (m) — not Civil 3D corridor radii. */
export const PATH_FILLET_LOCKS_M = [0, 0.3, 0.6, 0.9] as const;
export type PathFilletLockM = (typeof PATH_FILLET_LOCKS_M)[number];

export function isPathFilletLockM(n: number): n is PathFilletLockM {
  return (PATH_FILLET_LOCKS_M as readonly number[]).includes(n);
}

export function snapPathFilletM(n: number): PathFilletLockM {
  if (!Number.isFinite(n) || n < 0) return 0;
  let best: PathFilletLockM = 0;
  let bestD = Infinity;
  for (const r of PATH_FILLET_LOCKS_M) {
    const d = Math.abs(r - n);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export function hardscapeWhy(
  widthM: PathWidthLockM,
  edge: HardscapeEdgeType,
  filletM: PathFilletLockM = 0,
): string {
  const fillet =
    filletM > 0 ? ` · R${filletM.toFixed(1)} fillet` : "";
  return `${widthM.toFixed(1)} m path · ${HARDSCAPE_EDGE_LABELS[edge]} edge${fillet}`;
}

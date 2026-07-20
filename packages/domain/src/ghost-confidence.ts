/**
 * Live, data-driven ghost confidence factors — not a cosmetic hash split.
 * Factors recompute from current canvas state (TPZ margin, sun shadow vector,
 * relative material cost). Drainage stays a flat neutral until services
 * tracing lands in a follow-on PR.
 */

export type ConfidenceFactor = {
  label: string;
  pct: number;
};

export type LiveGhostSubject = {
  typeId: string;
  x: number;
  y: number;
  scale?: number;
  /** Unit rate AUD for cost-efficiency scoring. */
  rate: number;
  canopyM?: number;
  heightM?: number;
  /** Catalog peers for relative cost (same billing shape). */
  peerRates: number[];
  isHedge?: boolean;
  isFrenchDrain?: boolean;
  /** Seed confidence from the suggestion pipeline (0–1), for live-drift tag. */
  seedConf?: number;
};

export type LiveGhostTree = {
  x: number;
  y: number;
  /** TPZ radius already expressed in board % (rx). */
  tpzRadiusPct: number;
  canopyM: number;
  heightM: number;
  scale: number;
  existing: boolean;
};

export type LiveGhostScene = {
  trees: LiveGhostTree[];
  /** Other canopy plantings that cast shade (accepted + non-ghost). */
  shadeCasters: LiveGhostTree[];
  buildingCentroid: { x: number; y: number };
  scaleM: number;
  /** Unit-ish shadow direction + length factor from the sun scrubber. */
  shadow: { dx: number; dy: number; factor: number };
  /** Growth multiplier for non-existing canopy (plant / 5yr / mature). */
  growthFactor: number;
};

export type LiveConfidenceResult = {
  factors: ConfidenceFactor[];
  /** Average of factor percentages as 0–1. */
  overall: number;
  notes: string[];
  /** True when live overall drifted ≥3 pts from seedConf. */
  liveDrift: boolean;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Neutral drainage score until traced services exist (#15 follow-on). */
export const NEUTRAL_DRAINAGE_SCORE = 68;

/**
 * Southern-hemisphere day arc shadow vector from sun minutes-of-day.
 * Matches the prototype sun scrubber: W → S → E through the day.
 */
export function sunShadowVector(sunMin: number): {
  dx: number;
  dy: number;
  factor: number;
} {
  const dayStart = 6 * 60 + 20;
  const dayEnd = 19 * 60 + 40;
  const sunFrac = clamp((sunMin - dayStart) / (dayEnd - dayStart), 0, 1);
  const angle = Math.PI * (1 - sunFrac);
  const factor = 0.32 + 2.3 * Math.abs(sunFrac - 0.5);
  return { dx: Math.cos(angle), dy: Math.sin(angle) * 0.65, factor };
}

export function growthFactorFromStage(
  growth: "plant" | "5yr" | "mature",
): number {
  if (growth === "plant") return 0.45;
  if (growth === "5yr") return 0.75;
  return 1;
}

export function ghostCategoryFromSymbol(
  symbolId: string,
  label: string,
): "tree" | "hardscape" | "drainage" | "generic" {
  const s = `${symbolId} ${label}`.toLowerCase();
  if (/drain|french|storm/.test(s)) return "drainage";
  if (/pav|deck|hard|bluestone|concrete/.test(s)) return "hardscape";
  if (/tree|canopy|hedge|plant|lawn|bed/.test(s)) return "tree";
  return "generic";
}

/** Empty scene for call sites without live canvas context. */
export function emptyLiveGhostScene(
  scaleM = 110,
  sunMin = 12 * 60,
): LiveGhostScene {
  return {
    trees: [],
    shadeCasters: [],
    buildingCentroid: { x: 50, y: 50 },
    scaleM,
    shadow: sunShadowVector(sunMin),
    growthFactor: 1,
  };
}

function rootClearanceScore(
  ghost: LiveGhostSubject,
  trees: LiveGhostTree[],
): number {
  if (trees.length === 0) return 78;
  const nearestMargin = Math.min(
    ...trees.map(
      (tr) => Math.hypot(ghost.x - tr.x, ghost.y - tr.y) - tr.tpzRadiusPct,
    ),
  );
  return Math.round(clamp(58 + nearestMargin * 9, 20, 97));
}

function costEfficiencyScore(ghost: LiveGhostSubject): number {
  const rates = ghost.peerRates.filter((r) => r > 0);
  const maxRate = Math.max(...rates, ghost.rate || 1, 1);
  return Math.round(clamp(100 - (ghost.rate / maxRate) * 55, 45, 96));
}

function sunExposureScore(
  ghost: LiveGhostSubject,
  scene: LiveGhostScene,
): number {
  const typeId = ghost.typeId.toLowerCase();
  const isCanopyPlanting =
    (typeId === "canopy" || typeId === "feature") && Boolean(ghost.canopyM);

  if (isCanopyPlanting) {
    const bld = scene.buildingCentroid;
    const toGhost = { x: ghost.x - bld.x, y: ghost.y - bld.y };
    const wantDir = { x: -scene.shadow.dx, y: -scene.shadow.dy };
    const len = Math.hypot(toGhost.x, toGhost.y) || 1;
    const wlen = Math.hypot(wantDir.x, wantDir.y) || 1;
    const dot =
      (toGhost.x * wantDir.x + toGhost.y * wantDir.y) / (len * wlen);
    return Math.round(clamp(55 + dot * 40, 30, 97));
  }
  if (ghost.isHedge) return 68;

  const casters = scene.trees.concat(scene.shadeCasters);
  const shaded = casters.some((tr) => {
    const gk = tr.existing ? 1 : scene.growthFactor;
    const hM = tr.heightM * tr.scale * gk;
    const lenM = hM * scene.shadow.factor;
    const sx = tr.x + ((scene.shadow.dx * lenM) / scene.scaleM) * 100;
    const sy = tr.y + ((scene.shadow.dy * lenM) / scene.scaleM) * 100;
    const r = ((tr.canopyM * tr.scale * gk) / 2 / scene.scaleM) * 100;
    return Math.hypot(ghost.x - sx, ghost.y - sy) < r * 2.4;
  });
  return shaded ? 42 : 88;
}

function screeningScore(
  ghost: LiveGhostSubject,
  boundary: { x: number; y: number }[] | null,
): number | null {
  if (!ghost.isHedge || !boundary || boundary.length < 3) return null;
  let nearest = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % boundary.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(
      ((ghost.x - a.x) * dx + (ghost.y - a.y) * dy) / len2,
      0,
      1,
    );
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    nearest = Math.min(nearest, Math.hypot(ghost.x - px, ghost.y - py));
  }
  return Math.round(clamp(95 - nearest * 9, 40, 97));
}

export type LiveConfidenceOpts = {
  /** Optional boundary for hedge screening; omit → skip screening factor. */
  boundary?: { x: number; y: number }[];
};

/**
 * Compute live confidence factors for a ghost. Top-line overall is the
 * average of the returned factor percentages.
 */
export function computeLiveConfidenceFactors(
  ghost: LiveGhostSubject,
  scene: LiveGhostScene,
  opts?: LiveConfidenceOpts,
): LiveConfidenceResult {
  const rootScore = rootClearanceScore(ghost, scene.trees);
  const costScore = costEfficiencyScore(ghost);
  const sunScore = sunExposureScore(ghost, scene);
  const drainageScore = NEUTRAL_DRAINAGE_SCORE;
  const screen = screeningScore(ghost, opts?.boundary ?? null);

  const typeId = ghost.typeId.toLowerCase();
  let pairs: [string, number][];
  if (typeId === "canopy" || typeId === "feature") {
    pairs = [
      ["Sun exposure", sunScore],
      ["Root clearance", rootScore],
      ["Cost efficiency", costScore],
    ];
  } else if (typeId === "hedge") {
    pairs = [
      ["Screening effectiveness", screen ?? 70],
      ["Cost efficiency", costScore],
      ["Root clearance", rootScore],
    ];
  } else if (typeId === "frenchdrain") {
    pairs = [
      ["Drainage intercept", drainageScore],
      ["Cost efficiency", costScore],
      ["Root clearance", rootScore],
    ];
  } else if (
    typeId === "deck" ||
    typeId === "paving" ||
    typeId === "lawn" ||
    typeId === "bed"
  ) {
    pairs = [
      ["Drainage intercept", drainageScore],
      ["Cost efficiency", costScore],
      ["Sun exposure", sunScore],
    ];
  } else {
    pairs = [
      ["Sun exposure", sunScore],
      ["Cost efficiency", costScore],
      ["Drainage intercept", drainageScore],
    ];
  }

  const factors: ConfidenceFactor[] = pairs.map(([label, val]) => ({
    label,
    pct: Math.round(clamp(val, 15, 99)),
  }));
  const overall =
    factors.reduce((s, f) => s + f.pct, 0) / (factors.length * 100);

  const notes: string[] = [];
  for (const tr of scene.trees) {
    if (Math.hypot(ghost.x - tr.x, ghost.y - tr.y) < tr.tpzRadiusPct) {
      notes.push("Encroaches existing-tree root zone");
      break;
    }
  }

  const seedPct = Math.round((ghost.seedConf ?? overall) * 100);
  const livePct = Math.round(overall * 100);
  const liveDrift = Math.abs(livePct - seedPct) >= 3;

  return { factors, overall, notes, liveDrift };
}

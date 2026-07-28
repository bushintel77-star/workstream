/**
 * Growth-scrubbed canopy + root rings for the temporal slider (§4).
 *
 * Year 1 / 5 / 10 scale mature spread onto the board so the operator can
 * *see* competition before share — findings already warn; these rings are
 * the spatial twin. Indicative metres; confirm on site.
 *
 * Domain-pure: no server / DOM imports.
 */

export type GrowthStageId = "plant" | "5yr" | "mature";

export type GrowthTemporalItem = {
  id: string;
  /** Studio item type — only planting masses get rings. */
  type: string;
  x: number;
  y: number;
  /** Mature canopy diameter (m) when known from catalogue. */
  mature_spread_m?: number | null;
  /** Existing trees use TPZ elsewhere — skip temporal rings. */
  existing?: boolean;
};

export type GrowthTemporalRing = {
  id: string;
  x: number;
  y: number;
  /** Canopy radius in board % at the scrubbed stage. */
  canopy_rx_pct: number;
  /** Indicative root / competition disc (~0.55× canopy) in board %. */
  root_rx_pct: number;
  /** True when this canopy closes on a neighbour past the overlap ratio. */
  crowded: boolean;
  mature_spread_m: number;
  stage: GrowthStageId;
};

/** Same ratio as board-findings canopy crowding. */
export const TEMPORAL_CANOPY_OVERLAP_RATIO = 0.75;

/** Root disc as a share of canopy radius — indicative, not AS 4970 SRZ. */
export const TEMPORAL_ROOT_TO_CANOPY = 0.55;

const DEFAULT_SPREAD_M: Record<string, number> = {
  canopy: 6,
  hedge: 1.8,
  bed: 2.2,
  feature: 3.5,
};

const PLANTING_TYPES = new Set(["canopy", "hedge", "bed", "feature"]);

export function growthStageSpreadFactor(stage: GrowthStageId): number {
  if (stage === "plant") return 0.45;
  if (stage === "5yr") return 0.75;
  return 1;
}

export function defaultMatureSpreadM(type: string): number | null {
  return DEFAULT_SPREAD_M[type] ?? null;
}

function mToPct(m: number, scaleM: number): number {
  if (!(scaleM > 0)) return 0;
  return (m / scaleM) * 100;
}

/**
 * Build visible canopy + root rings for the current growth scrub.
 * Empty when scale is unknown or no planting has a spread.
 */
export function buildGrowthTemporalRings(input: {
  items: readonly GrowthTemporalItem[];
  growth: GrowthStageId;
  scaleM: number;
}): GrowthTemporalRing[] {
  const { growth, scaleM } = input;
  if (!(scaleM > 0)) return [];

  const factor = growthStageSpreadFactor(growth);
  const candidates: Array<{
    id: string;
    x: number;
    y: number;
    spreadM: number;
    canopyRM: number;
  }> = [];

  for (const it of input.items) {
    if (it.existing) continue;
    if (!PLANTING_TYPES.has(it.type)) continue;
    const spread =
      it.mature_spread_m != null && it.mature_spread_m > 0
        ? it.mature_spread_m
        : defaultMatureSpreadM(it.type);
    if (spread == null || spread <= 0) continue;
    const canopyRM = (spread / 2) * factor;
    if (canopyRM <= 0) continue;
    candidates.push({
      id: it.id,
      x: it.x,
      y: it.y,
      spreadM: spread,
      canopyRM,
    });
  }

  const crowded = new Set<string>();
  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i]!;
    for (let j = i + 1; j < candidates.length; j += 1) {
      const b = candidates[j]!;
      const gapM =
        (Math.hypot(a.x - b.x, a.y - b.y) / 100) * scaleM;
      const reachM = a.canopyRM + b.canopyRM;
      if (gapM < reachM * TEMPORAL_CANOPY_OVERLAP_RATIO) {
        crowded.add(a.id);
        crowded.add(b.id);
      }
    }
  }

  return candidates.map((c) => {
    const canopyRx = mToPct(c.canopyRM, scaleM);
    return {
      id: c.id,
      x: c.x,
      y: c.y,
      canopy_rx_pct: canopyRx,
      root_rx_pct: canopyRx * TEMPORAL_ROOT_TO_CANOPY,
      crowded: crowded.has(c.id),
      mature_spread_m: c.spreadM,
      stage: growth,
    };
  });
}

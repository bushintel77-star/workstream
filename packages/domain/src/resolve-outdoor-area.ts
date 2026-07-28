import type { LngLat } from "./geometry";
import { polygonArea } from "./geometry";
import type { BoardProvenance } from "./board-context";

/**
 * Mock survey uses a fixed 15×40 m rectangle with edge ids front/east/back/west.
 * Treat those areas as absent — never promote seed geometry as surveyed outdoor.
 */
export function isSeedSurveyLot(args: {
  lot_area_m2: number;
  measurements: Array<{ edge_id: string }>;
}): boolean {
  const ids = new Set(args.measurements.map((m) => m.edge_id));
  return (
    args.lot_area_m2 === 600 &&
    ids.has("front") &&
    ids.has("east") &&
    ids.has("back") &&
    ids.has("west")
  );
}

/**
 * Board-% shoelace → m². `scaleM` = metres across 100% of the board width
 * (same convention as handoff `polygonAreaM2`).
 */
export function polygonAreaFromBoardPercent(
  points: Array<{ x_pct: number; y_pct: number }>,
  scaleM: number,
  boardAspect = 1,
): number {
  if (points.length < 3 || !(scaleM > 0) || !(boardAspect > 0)) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x_pct * b.y_pct - b.x_pct * a.y_pct;
  }
  const aPct2 = Math.abs(sum) / 2;
  return (aPct2 * (scaleM / 100) ** 2) / boardAspect;
}

function positive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Lot − housing envelope. No envelope → lot stands (nothing honest to deduct). */
export function deductibleOutdoorM2(
  lotM2: number,
  houseM2: number | null | undefined,
): number {
  const house = positive(houseM2) ?? 0;
  return Math.max(0, lotM2 - house);
}

export type OutdoorAreaResolution = {
  /** Workable outdoor = lot − housing envelope when known. */
  outdoor_m2: number | null;
  /** Lot / title m² when known. */
  lot_m2: number | null;
  /** Housing envelope m² when known (Vicmap building or traced dwelling). */
  house_m2: number | null;
  /** Provenance of the outdoor figure (or absent). */
  outdoor_provenance: BoardProvenance;
  /** Provenance of the lot figure (or absent). */
  lot_provenance: BoardProvenance;
};

/**
 * Honest outdoor / lot cascade — never invent a figure.
 *
 * Outdoor is the *deductible* remnant: lot − housing envelope.
 * Vicmap `garden_area_m2` is already that remnant. Lot / title / traced
 * boundary fall back only after deducting house_area_m2 or a traced dwelling.
 *
 * 1. Survey garden (already lot − house) when not a seed mock
 * 2. Survey / title lot − house envelope
 * 3. Operator-traced board boundary − dwelling × ground scale
 * 4. null / absent
 */
export function resolveOutdoorAreaM2(args: {
  garden_area_m2?: number | null;
  lot_area_m2?: number | null;
  house_area_m2?: number | null;
  /** Legacy 15×40 mock — areas discarded. */
  seedLot?: boolean;
  titleRing?: LngLat[] | null;
  /** Vicmap / survey house ring when house_area_m2 is missing. */
  houseRing?: LngLat[] | null;
  boundary?: Array<{ x_pct: number; y_pct: number }> | null;
  /** Operator-traced housing envelope on the board. */
  building?: Array<{ x_pct: number; y_pct: number }> | null;
  scaleM?: number | null;
  boardAspect?: number;
}): OutdoorAreaResolution {
  const seed = Boolean(args.seedLot);
  const garden = seed ? null : positive(args.garden_area_m2);
  const lotSurvey = seed ? null : positive(args.lot_area_m2);
  const aspect = args.boardAspect ?? 1;
  const scaleM = args.scaleM;

  let titleM2: number | null = null;
  if (!seed && args.titleRing && args.titleRing.length >= 3) {
    const a = polygonArea(args.titleRing);
    if (Number.isFinite(a) && a > 0) titleM2 = Math.round(a);
  }

  let houseFromRing: number | null = null;
  if (!seed && args.houseRing && args.houseRing.length >= 3) {
    const a = polygonArea(args.houseRing);
    if (Number.isFinite(a) && a > 0) houseFromRing = Math.round(a);
  }

  let drawnLotM2: number | null = null;
  let drawnHouseM2: number | null = null;
  if (scaleM != null && scaleM > 0) {
    if (args.boundary && args.boundary.length >= 3) {
      const a = polygonAreaFromBoardPercent(args.boundary, scaleM, aspect);
      if (Number.isFinite(a) && a > 0) drawnLotM2 = Math.round(a * 100) / 100;
    }
    if (args.building && args.building.length >= 3) {
      const a = polygonAreaFromBoardPercent(args.building, scaleM, aspect);
      if (Number.isFinite(a) && a > 0) drawnHouseM2 = Math.round(a * 100) / 100;
    }
  }

  const surveyHouse = seed ? null : positive(args.house_area_m2);
  /** Prefer the board housing envelope; else Vicmap house area / ring. */
  const house_m2 = drawnHouseM2 ?? surveyHouse ?? houseFromRing;

  let lot_m2: number | null = null;
  let lot_provenance: BoardProvenance = "absent";
  if (lotSurvey != null) {
    lot_m2 = Math.round(lotSurvey);
    lot_provenance = "vicmap";
  } else if (titleM2 != null) {
    lot_m2 = titleM2;
    lot_provenance = "vicmap";
  } else if (drawnLotM2 != null) {
    lot_m2 = drawnLotM2;
    lot_provenance = "operator";
  }

  let outdoor_m2: number | null = null;
  let outdoor_provenance: BoardProvenance = "absent";
  if (garden != null) {
    // Vicmap garden is already title − building.
    outdoor_m2 = Math.round(garden);
    outdoor_provenance = "vicmap";
  } else if (lot_m2 != null) {
    outdoor_m2 = Math.round(deductibleOutdoorM2(lot_m2, house_m2) * 100) / 100;
    // Deducting a housing envelope is derived; bare lot keeps its source.
    outdoor_provenance = house_m2 != null ? "derived" : lot_provenance;
  }

  return {
    outdoor_m2,
    lot_m2,
    house_m2: house_m2 != null ? Math.round(house_m2 * 100) / 100 : null,
    outdoor_provenance,
    lot_provenance,
  };
}

import {
  gardenFamilyForSymbol,
  symbolMatureHeightM,
  symbolSpreadM,
} from "./garden-asset-height";
import type { GardenAssetFamily } from "./garden-size-ladder";

export type ElevationItem = {
  id: string;
  label: string;
  xPct: number;
  widthPct: number;
  /** Drawn height (m) — mature height with the placement scale applied. */
  heightM: number;
  /** Catalog mature height (m) before scale. */
  matureHeightM: number;
  /** Placement scale (1 = as catalogued). */
  scale: number;
  /** Mature spread / platform width (m), null when the symbol is unknown. */
  spreadM: number | null;
  /** Silhouette family, null for structures / fixtures (plain profile). */
  family: GardenAssetFamily | null;
  symbolId: string | null;
  /**
   * True when the height is *known* (given by the caller or carried by the
   * symbol) rather than guessed. Elevation surfaces draw only these.
   */
  hasPresence: boolean;
  ghost: boolean;
  stale?: boolean;
};

export type ElevationProjectionInput = {
  id: string;
  label: string;
  x_pct: number;
  y_pct: number;
  scale?: number;
  /** Explicit height (m) — wins over the symbol's catalogued height. */
  height_m?: number;
  /** Placed catalog symbol — the durable source of height and family. */
  symbol_id?: string;
  /** Explicit spread (m) — wins over the symbol's default width. */
  spread_m?: number;
  ghost?: boolean;
  stale?: boolean;
};

export type ElevationProjectionOpts = {
  /** Dwelling envelope height (m) for the building mass. */
  buildingHeightM?: number;
  /**
   * Metres across the full board width. Supplied → bar widths come from real
   * spread; omitted → the indicative scale-based width is used.
   */
  boardWidthM?: number;
};

export type ElevationProjection = {
  groundY: number;
  buildingH: number;
  items: ElevationItem[];
  /** Tallest drawn height (m) among items with presence; 0 when none. */
  maxHeightM: number;
  look: ElevationLook;
};

/** Minimum / maximum bar width (% of board) so no profile vanishes or floods. */
const MIN_BAR_PCT = 0.6;
const MAX_BAR_PCT = 40;

/** @deprecated Prefer ElevationLook — front≈looking north, side≈looking east. */
export type ElevationAxis = "front" | "side";

/**
 * Cardinal look direction — look *toward* title north/east/south/west.
 * Board: x→east, y↓south.
 */
export type ElevationLook = "N" | "S" | "E" | "W";

export const ELEVATION_LOOKS: readonly ElevationLook[] = [
  "N",
  "E",
  "S",
  "W",
] as const;

export type ElevationProjector = {
  /** Plan axis sampled for the 1D elevation. */
  axis: "x" | "y";
  /** Mirror so left→right matches the looker's left. */
  reverse: boolean;
  label: string;
  shortLabel: string;
};

export function elevationLookProjector(look: ElevationLook): ElevationProjector {
  switch (look) {
    case "N":
      return {
        axis: "x",
        reverse: false,
        label: "Elevation looking north",
        shortLabel: "Looking N",
      };
    case "S":
      return {
        axis: "x",
        reverse: true,
        label: "Elevation looking south",
        shortLabel: "Looking S",
      };
    case "E":
      return {
        axis: "y",
        reverse: false,
        label: "Elevation looking east",
        shortLabel: "Looking E",
      };
    case "W":
      return {
        axis: "y",
        reverse: true,
        label: "Elevation looking west",
        shortLabel: "Looking W",
      };
  }
}

/** Next look in N→E→S→W cycle. */
export function cycleElevationLook(look: ElevationLook): ElevationLook {
  const i = ELEVATION_LOOKS.indexOf(look);
  return ELEVATION_LOOKS[(i + 1) % ELEVATION_LOOKS.length]!;
}

/** Companion look 90° CW — classic Fit sheet pair (e.g. N + E). */
export function elevationLookPair(look: ElevationLook): ElevationLook {
  return cycleElevationLook(look);
}

/**
 * Brochure / dark-concept elev pick — cardinal look that shows the widest
 * dwelling face (street-front heuristic when Vicmap building is wide).
 */
export function preferBrochureElevLook(
  building: Array<{ x: number; y: number }>,
): ElevationLook {
  if (building.length < 2) return "N";
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of building) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // Wider east-west face → look north/south; taller N–S mass → look east/west.
  return spanX >= spanY ? "N" : "E";
}

function lookFromLegacyAxis(axis: ElevationAxis): ElevationLook {
  return axis === "front" ? "N" : "E";
}

/** Last-resort height when neither the caller nor the symbol knows one. */
function guessHeightM(label: string): number {
  return label.toLowerCase().includes("tree") ? 4 : 1.2;
}

function barWidthPct(
  spreadM: number | null,
  scale: number,
  boardWidthM: number | undefined,
): number {
  if (boardWidthM != null && boardWidthM > 0 && spreadM != null && spreadM > 0) {
    const pct = ((spreadM * scale) / boardWidthM) * 100;
    return Math.min(MAX_BAR_PCT, Math.max(MIN_BAR_PCT, pct));
  }
  return Math.max(2, scale * 4);
}

/**
 * Project plan items onto a 1D elevation axis.
 *
 * Single source of truth for plan → elevation: the elevation board and the fit
 * sheet both read this so their profiles cannot drift apart. Height comes from
 * the caller, else the placed symbol, else an indicative guess.
 */
export function projectElevationItems(
  items: ElevationProjectionInput[],
  axisOrLook: ElevationAxis | ElevationLook,
  opts: ElevationProjectionOpts = {},
): ElevationProjection {
  const look: ElevationLook =
    axisOrLook === "front" || axisOrLook === "side"
      ? lookFromLegacyAxis(axisOrLook)
      : axisOrLook;
  const proj = elevationLookProjector(look);
  const raw = items.map((it): ElevationItem => {
    const along = proj.axis === "x" ? it.x_pct : it.y_pct;
    const xPct = proj.reverse ? 100 - along : along;
    const scale = it.scale != null && it.scale > 0 ? it.scale : 1;
    const symbolId = it.symbol_id?.trim() || null;
    const known = it.height_m ?? symbolMatureHeightM(symbolId) ?? null;
    const matureHeightM = known ?? guessHeightM(it.label);
    const spreadM = it.spread_m ?? symbolSpreadM(symbolId) ?? null;
    return {
      id: it.id,
      label: it.label,
      xPct,
      widthPct: barWidthPct(spreadM, scale, opts.boardWidthM),
      heightM: matureHeightM * scale,
      matureHeightM,
      scale,
      spreadM,
      family: gardenFamilyForSymbol(symbolId),
      symbolId,
      hasPresence: (known ?? 0) > 0,
      ghost: Boolean(it.ghost),
      stale: it.stale,
    };
  });
  const sorted = [...raw].sort((a, b) => a.xPct - b.xPct);
  const maxHeightM = sorted.reduce(
    (max, it) => (it.hasPresence ? Math.max(max, it.heightM) : max),
    0,
  );
  return {
    groundY: 0,
    buildingH: opts.buildingHeightM ?? 2.7,
    items: sorted,
    maxHeightM,
    look,
  };
}

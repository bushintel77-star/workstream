import { DWELLING_HATCH_IDS } from "../features/render/renderTokens";
import {
  PALETTE,
  SEMANTIC_DARK,
  SEMANTIC_LIGHT,
} from "../../../../styles/colorTokens";

/**
 * CAD plan line symbology — colour from color-tokens v2 (existing crimson,
 * proposed cobalt, retain forest, easement slate). Weights unchanged.
 *
 * Line-weight ladder: boundary 1.4 > building 1.05 > hardscape 0.6 >
 * planting/existing 0.4. Night board uses dark semantic stops.
 */

export type PlanLineKind =
  | "boundary"
  | "building"
  | "hardscape"
  | "planting"
  | "existing"
  | "easement"
  | "service"
  | "setback"
  | "dim";

export type PlanLineStyle = {
  stroke: string;
  strokeWidth: number;
  dash?: string;
  fill?: string;
  opacity?: number;
};

const L = SEMANTIC_LIGHT;
const D = SEMANTIC_DARK;

/** Light parchment (default atelier). */
export const PLAN_LINES_LIGHT: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: L.textPrimary,
    strokeWidth: 1.4,
  },
  building: {
    // Existing dwelling — crimson stroke + hatch wash.
    stroke: L.existingStroke,
    strokeWidth: 1.05,
    fill: `url(#${DWELLING_HATCH_IDS.light})`,
  },
  hardscape: {
    stroke: L.proposedStroke,
    strokeWidth: 0.6,
  },
  planting: {
    stroke: L.plantingNewStroke,
    strokeWidth: 0.4,
  },
  existing: {
    stroke: L.plantingRetainStroke,
    strokeWidth: 0.4,
    dash: "2.5 2",
  },
  easement: {
    stroke: L.easementStroke,
    strokeWidth: 0.85,
    dash: "1.4 1.1",
  },
  service: {
    /* Untyped service corridor — water APWA (typed BYDA uses bydaPlanStyles). */
    stroke: PALETTE.apwaWater,
    strokeWidth: 0.9,
    dash: "2.4 1.5",
  },
  setback: {
    stroke: L.textSecondary,
    strokeWidth: 0.75,
    dash: "3 3",
  },
  dim: {
    stroke: PALETTE.grayL700,
    strokeWidth: 0.7,
  },
};

/** Dark / night plate — stroke stops (not text stops) for linework. */
export const PLAN_LINES_DARK: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: D.textPrimary,
    strokeWidth: 1.4,
  },
  building: {
    stroke: D.existingStroke,
    strokeWidth: 1.05,
    fill: `url(#${DWELLING_HATCH_IDS.night})`,
  },
  hardscape: {
    stroke: D.proposedStroke,
    strokeWidth: 0.6,
  },
  planting: {
    stroke: D.plantingNewStroke,
    strokeWidth: 0.4,
  },
  existing: {
    stroke: D.plantingRetainStroke,
    strokeWidth: 0.4,
    dash: "2.5 2",
  },
  easement: {
    stroke: D.easementStroke,
    strokeWidth: 0.85,
    dash: "1.4 1.1",
  },
  service: {
    stroke: PALETTE.apwaWater,
    strokeWidth: 0.9,
    dash: "2.4 1.5",
  },
  setback: {
    stroke: D.textSecondary,
    strokeWidth: 0.75,
    dash: "3 3",
  },
  dim: {
    stroke: PALETTE.grayD800,
    strokeWidth: 0.7,
  },
};

/**
 * Locked Vicmap / Stage 1 title — solid property line, solid footprint.
 * Keeps colour hierarchy (never flatten building to the same ink as boundary).
 */
export function planLinesFor(opts: {
  darkOn: boolean;
  titleSolid: boolean;
  fitSheet: boolean;
}): Record<PlanLineKind, PlanLineStyle> {
  const base = opts.darkOn && !opts.fitSheet ? PLAN_LINES_DARK : PLAN_LINES_LIGHT;
  if (opts.titleSolid || opts.fitSheet) {
    return {
      ...base,
      boundary: {
        ...base.boundary,
        dash: opts.fitSheet && !opts.titleSolid ? "4 4" : undefined,
        strokeWidth: 1.4,
      },
      building: {
        ...base.building,
        strokeWidth: 1.05,
      },
    };
  }
  return {
    ...base,
    boundary: {
      ...base.boundary,
      dash: "5 3.5",
      strokeWidth: 1.4,
    },
  };
}

/** Map catalog item types onto the line-weight ladder. */
export function planLineKindForItem(
  type: string,
): "hardscape" | "planting" | "existing" {
  if (type === "exist") return "existing";
  if (type === "paving" || type === "deck" || type === "frenchdrain") {
    return "hardscape";
  }
  return "planting";
}

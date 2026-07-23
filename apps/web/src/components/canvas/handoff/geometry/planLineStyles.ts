import { DWELLING_HATCH_IDS } from "../features/render/renderTokens";

/**
 * CAD plan line symbology — each kind has a distinct colour + weight + dash
 * so boundary ≠ building ≠ hardscape ≠ planting at a glance on blush parchment.
 *
 * Line-weight ladder (light): boundary 1.4 > building 1.05 > hardscape 0.6 >
 * planting/existing 0.4. Night board uses chalk equivalents at the same weights.
 */

export type PlanLineKind =
  | "boundary"
  | "building"
  | "hardscape"
  | "planting"
  | "existing"
  | "context"
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

/** Light parchment (default atelier) — near-black ink ladder. */
export const PLAN_LINES_LIGHT: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: "#1A1A1A",
    strokeWidth: 1.4,
  },
  building: {
    // Existing dwelling: 45° convention hatch over a faint wash (plan standard
    // for "existing structure"), envelope outline one step under boundary.
    stroke: "#8B3A2F",
    strokeWidth: 1.05,
    fill: `url(#${DWELLING_HATCH_IDS.light})`,
  },
  hardscape: {
    stroke: "#5B6570",
    strokeWidth: 0.6,
  },
  planting: {
    stroke: "#5F7A50",
    strokeWidth: 0.4,
  },
  existing: {
    stroke: "#5A4650",
    strokeWidth: 0.4,
    dash: "2.5 2",
  },
  context: {
    stroke: "rgba(28, 25, 23, 0.35)",
    strokeWidth: 0.5,
    opacity: 0.55,
    fill: "rgba(28, 25, 23, 0.015)",
  },
  easement: {
    stroke: "#B45309",
    strokeWidth: 0.85,
    dash: "1.4 1.1",
  },
  service: {
    stroke: "#1D4E89",
    strokeWidth: 0.9,
    dash: "2.4 1.5",
  },
  setback: {
    stroke: "#6B5B8C",
    strokeWidth: 0.75,
    dash: "3 3",
  },
  dim: {
    stroke: "#5B6B7A",
    strokeWidth: 0.7,
  },
};

/** Dark / night plate — chalk linework, same weight ladder. */
export const PLAN_LINES_DARK: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: "rgba(236, 239, 244, 0.92)",
    strokeWidth: 1.4,
  },
  building: {
    stroke: "#8fb0ff",
    strokeWidth: 1.05,
    fill: `url(#${DWELLING_HATCH_IDS.night})`,
  },
  hardscape: {
    stroke: "rgba(236, 239, 244, 0.72)",
    strokeWidth: 0.6,
  },
  planting: {
    stroke: "rgba(180, 210, 170, 0.75)",
    strokeWidth: 0.4,
  },
  existing: {
    stroke: "rgba(236, 239, 244, 0.55)",
    strokeWidth: 0.4,
    dash: "2.5 2",
  },
  context: {
    stroke: "rgba(236, 239, 244, 0.28)",
    strokeWidth: 0.5,
    opacity: 0.5,
    fill: "rgba(236, 239, 244, 0.02)",
  },
  easement: {
    stroke: "#F0B429",
    strokeWidth: 0.85,
    dash: "1.4 1.1",
  },
  service: {
    stroke: "#7EB6E8",
    strokeWidth: 0.9,
    dash: "2.4 1.5",
  },
  setback: {
    stroke: "#C4B5E0",
    strokeWidth: 0.75,
    dash: "3 3",
  },
  dim: {
    stroke: "rgba(200, 214, 228, 0.7)",
    strokeWidth: 0.7,
  },
};

/**
 * Locked Vicmap / Stage 1 title — solid property line, solid footprint.
 * Keeps colour hierarchy (never flatten building to the same ink as boundary).
 * Ladder weights apply in every mode including Fit sheet.
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
        // Fit sheet keeps a light dash language; locked title is solid.
        dash: opts.fitSheet && !opts.titleSolid ? "4 4" : undefined,
        strokeWidth: 1.4,
      },
      building: {
        ...base.building,
        strokeWidth: 1.05,
      },
    };
  }
  // Unlocked survey still reads boundary as a working dashed lot line.
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

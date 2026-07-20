/**
 * CAD plan line symbology — each kind has a distinct colour + weight + dash
 * so boundary ≠ building ≠ easement ≠ service at a glance on blush parchment.
 */

export type PlanLineKind =
  | "boundary"
  | "building"
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

/** Light parchment (default atelier). */
export const PLAN_LINES_LIGHT: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: "#1A1A1A",
    strokeWidth: 1.75,
    dash: "5 3.5",
  },
  building: {
    /* Soft blush-umber footprint — distinct from charcoal boundary, never alarm red. */
    stroke: "#7A5560",
    strokeWidth: 1.5,
    fill: "rgba(122, 85, 96, 0.06)",
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

/** Dark / night plate. */
export const PLAN_LINES_DARK: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: "#E8C37A",
    strokeWidth: 1.75,
    dash: "5 3.5",
  },
  building: {
    stroke: "#F0B4A8",
    strokeWidth: 2.15,
    fill: "rgba(240, 180, 168, 0.28)",
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
        dash: opts.fitSheet ? "4 4" : undefined,
        strokeWidth: opts.fitSheet ? 1.55 : 1.7,
      },
      building: {
        ...base.building,
        strokeWidth: opts.fitSheet ? 1.5 : 1.6,
      },
    };
  }
  return base;
}

/**
 * CAD plan line symbology — readable at a glance without colour noise.
 * Boundary ≠ building ≠ services ≠ hardscape language.
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
    stroke: "#1C1917",
    strokeWidth: 1.65,
    dash: "5 3.5",
  },
  building: {
    stroke: "#1C1917",
    strokeWidth: 2.1,
    fill: "rgba(28, 25, 23, 0.07)",
  },
  easement: {
    stroke: "#57534E",
    strokeWidth: 0.35,
    dash: "1.2 0.8",
  },
  service: {
    stroke: "#44403C",
    strokeWidth: 0.4,
    dash: "2.2 1.4",
  },
  setback: {
    stroke: "rgba(28, 25, 23, 0.45)",
    strokeWidth: 0.7,
    dash: "3 3",
  },
  dim: {
    stroke: "rgba(28, 25, 23, 0.55)",
    strokeWidth: 0.65,
  },
};

/** Dark / night plate. */
export const PLAN_LINES_DARK: Record<PlanLineKind, PlanLineStyle> = {
  boundary: {
    stroke: "#C99757",
    strokeWidth: 1.65,
    dash: "5 3.5",
  },
  building: {
    stroke: "#F7F4EF",
    strokeWidth: 2.1,
    fill: "rgba(247, 244, 239, 0.32)",
  },
  easement: {
    stroke: "#A8A29E",
    strokeWidth: 0.35,
    dash: "1.2 0.8",
  },
  service: {
    stroke: "#D6D3D1",
    strokeWidth: 0.4,
    dash: "2.2 1.4",
  },
  setback: {
    stroke: "rgba(201, 151, 87, 0.55)",
    strokeWidth: 0.7,
    dash: "3 3",
  },
  dim: {
    stroke: "rgba(247, 244, 239, 0.55)",
    strokeWidth: 0.65,
  },
};

/**
 * Locked Vicmap / Stage 1 title — solid property line, solid footprint.
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
        stroke: opts.fitSheet || !opts.darkOn ? "#1A1A1A" : base.boundary.stroke,
        dash: opts.fitSheet ? "4 4" : undefined,
        strokeWidth: 1.5,
      },
      building: {
        ...base.building,
        stroke: opts.darkOn && !opts.fitSheet ? "#F7F4EF" : "#1A1A1A",
        strokeWidth: opts.fitSheet ? 1.5 : 1.85,
      },
    };
  }
  return base;
}

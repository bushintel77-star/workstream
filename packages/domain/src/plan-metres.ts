/**
 * Working-plan metre frame for Stage 2 CadDocument / DXF.
 *
 * Prefer the operator-calibrated board width (Vicmap letterbox / fit), then
 * title/outdoor survey span, then aerial heuristic. Never claims survey
 * lodgement accuracy — honesty is always `working_plan`.
 */

export type PlanMetresSource =
  | "site_frame"
  | "title_outdoor"
  | "aerial"
  | "heuristic";

export type PlanMetres = {
  width_m: number;
  height_m: number;
  outdoor_area_m2: number | null;
  source: PlanMetresSource;
  honesty: "working_plan";
};

export type SurveySpanHint = {
  width_m: number;
  height_m: number;
  outdoor_area_m2: number;
  /** True when span came from Mapbox aerial frame rather than title/garden. */
  fromAerial?: boolean;
};

const HEURISTIC_M = 20;

/**
 * Single source of plan metres for CAD ensure / generate / DXF.
 * Callers assemble survey span via `groundSpanFromSurvey` (API) — this stays
 * domain-pure so it is unit-testable without a store.
 */
export function resolvePlanMetres(input: {
  boardWidthM?: number | null;
  /**
   * height/width when boardWidthM is set. Prefer survey span aspect when
   * known; default 1 (square % board).
   */
  boardAspect?: number | null;
  surveySpan?: SurveySpanHint | null;
}): PlanMetres {
  const boardW =
    typeof input.boardWidthM === "number" &&
    Number.isFinite(input.boardWidthM) &&
    input.boardWidthM > 0
      ? input.boardWidthM
      : null;

  if (boardW != null) {
    const aspect =
      typeof input.boardAspect === "number" &&
      Number.isFinite(input.boardAspect) &&
      input.boardAspect > 0
        ? input.boardAspect
        : 1;
    return {
      width_m: boardW,
      height_m: boardW * aspect,
      outdoor_area_m2: input.surveySpan?.outdoor_area_m2 ?? null,
      source: "site_frame",
      honesty: "working_plan",
    };
  }

  const span = input.surveySpan;
  if (
    span &&
    Number.isFinite(span.width_m) &&
    Number.isFinite(span.height_m) &&
    span.width_m >= 4 &&
    span.height_m >= 4
  ) {
    return {
      width_m: span.width_m,
      height_m: span.height_m,
      outdoor_area_m2: span.outdoor_area_m2,
      source: span.fromAerial ? "aerial" : "title_outdoor",
      honesty: "working_plan",
    };
  }

  if (span && span.width_m > 0 && span.height_m > 0) {
    // Sub-4 m outdoor hint still preferred over inventing 20×20 when present.
    return {
      width_m: Math.max(span.width_m, 4),
      height_m: Math.max(span.height_m, 4),
      outdoor_area_m2: span.outdoor_area_m2,
      source: span.fromAerial ? "aerial" : "title_outdoor",
      honesty: "working_plan",
    };
  }

  return {
    width_m: HEURISTIC_M,
    height_m: HEURISTIC_M,
    outdoor_area_m2: null,
    source: "heuristic",
    honesty: "working_plan",
  };
}

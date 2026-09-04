/**
 * Gold Standard 2026 — annotation dialect styling.
 *
 * THE HIERARCHY INVARIANT (the reason this file is data-driven):
 *
 *   The Truth Anchor tokens (`--ws-dwg-truth*`) mean "surveyed site truth". The
 *   title boundary carries them in EVERY dialect; no design category may use
 *   them, or any other blue, in ANY dialect.
 *
 * Dialects differentiate by line weight, hatch density and dash pattern — never
 * by hue. This is both how drafting dialects actually differ and the only way
 * the immutable/mutable read survives dialect switching.
 *
 * This used to be four hand-written branches, and they disagreed: the
 * `architectural` dialect (the CAD default) painted `property_line` with
 * `--ws-ink` (#1a1a1a) while giving `plant_tag`, `detail_callout` and
 * `scope_outline` the blue `--ws-active` — inverting the signal, so at
 * default settings the immutable survey boundary read as design ink and the
 * mutable design elements read as survey data. `style.invariant.test.ts` now
 * fails on any reintroduction.
 */

import type {
  AnnotationDialect,
  CategoryStyle,
  DialectStyleProfile,
  DraftingLineHierarchy,
  SurveyedAnnotationCategory,
} from "./model";

const HIERARCHY_BY_DIALECT: Record<AnnotationDialect, DraftingLineHierarchy> = {
  technical: { boundaryPx: 2.4, annotationPx: 1.15, guidePx: 0.7 },
  architectural: { boundaryPx: 2.1, annotationPx: 1.35, guidePx: 0.9 },
  creative: { boundaryPx: 1.9, annotationPx: 1.45, guidePx: 0.75 },
  hybrid: { boundaryPx: 2.25, annotationPx: 1.25, guidePx: 0.8 },
};

/** Hatch ink strength per dialect — the technical read is the densest. */
const HATCH_INK_MIX_PCT: Record<AnnotationDialect, number> = {
  technical: 58,
  architectural: 46,
  creative: 36,
  hybrid: 52,
};

/** Scope-extent dash per dialect. */
const SCOPE_DASH: Record<AnnotationDialect, string> = {
  technical: "6 4",
  architectural: "4 4",
  creative: "7 3",
  hybrid: "5 4",
};

/**
 * Categories that represent surveyed truth, and may therefore carry the Truth
 * Anchor. Everything else is design intent.
 */
export const SURVEY_TRUTH_CATEGORIES: readonly SurveyedAnnotationCategory[] = [
  "property_line",
];

export const DESIGN_CATEGORIES: readonly SurveyedAnnotationCategory[] = [
  "elevation_rl",
  "plant_tag",
  "material_hatch",
  "detail_callout",
  "scope_outline",
];

/**
 * Tokens reserved for surveyed truth. A design category resolving to any of
 * these is the hierarchy inversion this module exists to prevent.
 * `--ws-active*` is on the list because it is the CTA accent: close enough to
 * the Truth Anchor on paper to be misread as survey data, and off-brief for
 * drafting overlays regardless.
 */
export const RESERVED_TRUTH_TOKENS: readonly string[] = [
  "--ws-dwg-truth",
  "--ws-dwg-truth-ink",
  "--ws-dwg-truth-ink",
  "--ws-dwg-truth",
  "--ws-dwg-truth-ink",
  "--ws-active",
  "--ws-active",
];

function categoryStyles(
  dialect: AnnotationDialect,
  hierarchy: DraftingLineHierarchy,
): Record<SurveyedAnnotationCategory, CategoryStyle> {
  return {
    // Surveyed truth — Truth Anchor in every dialect. Only the weight varies.
    property_line: {
      stroke: "var(--ws-dwg-truth)",
      strokeWidth: hierarchy.boundaryPx,
      text: "var(--ws-dwg-truth-ink)",
    },
    // Measured levels read as strong ink; proposed vs existing is carried by
    // ink weight at render time, not by hue.
    elevation_rl: {
      stroke: "var(--ws-ink-secondary)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--ws-ink)",
    },
    plant_tag: {
      stroke: "var(--ws-ink)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--ws-ink)",
      fill: "color-mix(in srgb, var(--ws-panel) 84%, transparent)",
    },
    material_hatch: {
      stroke: `color-mix(in srgb, var(--ws-ink) ${HATCH_INK_MIX_PCT[dialect]}%, transparent)`,
      strokeWidth: hierarchy.guidePx,
      text: "var(--ws-ink-secondary)",
    },
    detail_callout: {
      stroke: "var(--ws-ink)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--ws-ink)",
    },
    scope_outline: {
      stroke: "var(--ws-ink-secondary)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--ws-ink-secondary)",
      dash: SCOPE_DASH[dialect],
    },
  };
}

export function dialectStyleProfile(dialect: AnnotationDialect): DialectStyleProfile {
  const hierarchy = HIERARCHY_BY_DIALECT[dialect];
  return {
    dialect,
    hierarchy,
    categories: categoryStyles(dialect, hierarchy),
  };
}

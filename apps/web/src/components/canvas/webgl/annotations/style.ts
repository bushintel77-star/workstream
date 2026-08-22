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

function categoryStyles(
  dialect: AnnotationDialect,
  hierarchy: DraftingLineHierarchy,
): Record<SurveyedAnnotationCategory, CategoryStyle> {
  if (dialect === "technical") {
    return {
      property_line: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.boundaryPx,
        text: "var(--gs-primary-ink)",
      },
      elevation_rl: {
        stroke: "var(--gs-ink-secondary)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink)",
      },
      plant_tag: {
        stroke: "var(--gs-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink)",
        fill: "color-mix(in srgb, var(--gs-glass) 84%, transparent)",
      },
      material_hatch: {
        stroke: "color-mix(in srgb, var(--gs-ink) 58%, transparent)",
        strokeWidth: hierarchy.guidePx,
        text: "var(--gs-ink-secondary)",
      },
      detail_callout: {
        stroke: "var(--gs-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink)",
      },
      scope_outline: {
        stroke: "var(--gs-ink-secondary)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink-secondary)",
        dash: "6 4",
      },
    };
  }
  if (dialect === "architectural") {
    return {
      property_line: {
        stroke: "var(--gs-ink)",
        strokeWidth: hierarchy.boundaryPx,
        text: "var(--gs-ink)",
      },
      elevation_rl: {
        stroke: "var(--gs-primary)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-primary-ink)",
      },
      plant_tag: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-primary-ink)",
        fill: "color-mix(in srgb, var(--gs-primary) 8%, var(--gs-canvas))",
      },
      material_hatch: {
        stroke: "color-mix(in srgb, var(--gs-ink) 46%, transparent)",
        strokeWidth: hierarchy.guidePx,
        text: "var(--gs-ink-secondary)",
      },
      detail_callout: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink)",
      },
      scope_outline: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-primary-ink)",
        dash: "4 4",
      },
    };
  }
  if (dialect === "creative") {
    return {
      property_line: {
        stroke: "color-mix(in srgb, var(--gs-ink-secondary) 82%, transparent)",
        strokeWidth: hierarchy.boundaryPx,
        text: "var(--gs-ink-secondary)",
      },
      elevation_rl: {
        stroke: "color-mix(in srgb, var(--gs-primary) 52%, transparent)",
        strokeWidth: hierarchy.guidePx,
        text: "var(--gs-ink-secondary)",
      },
      plant_tag: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-primary-ink)",
        fill: "color-mix(in srgb, var(--gs-primary) 11%, var(--gs-canvas))",
      },
      material_hatch: {
        stroke: "color-mix(in srgb, var(--gs-primary-ink) 36%, transparent)",
        strokeWidth: hierarchy.guidePx,
        text: "var(--gs-ink-secondary)",
      },
      detail_callout: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-ink)",
      },
      scope_outline: {
        stroke: "var(--gs-primary-ink)",
        strokeWidth: hierarchy.annotationPx,
        text: "var(--gs-primary-ink)",
        dash: "7 3",
      },
    };
  }
  return {
    property_line: {
      stroke: "var(--gs-primary-ink)",
      strokeWidth: hierarchy.boundaryPx,
      text: "var(--gs-primary-ink)",
    },
    elevation_rl: {
      stroke: "color-mix(in srgb, var(--gs-primary) 70%, var(--gs-ink-secondary))",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--gs-ink)",
    },
    plant_tag: {
      stroke: "var(--gs-primary-ink)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--gs-ink)",
      fill: "color-mix(in srgb, var(--gs-glass) 80%, transparent)",
    },
    material_hatch: {
      stroke: "color-mix(in srgb, var(--gs-ink) 52%, transparent)",
      strokeWidth: hierarchy.guidePx,
      text: "var(--gs-ink-secondary)",
    },
    detail_callout: {
      stroke: "var(--gs-ink)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--gs-ink)",
    },
    scope_outline: {
      stroke: "var(--gs-ink-secondary)",
      strokeWidth: hierarchy.annotationPx,
      text: "var(--gs-ink-secondary)",
      dash: "5 4",
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

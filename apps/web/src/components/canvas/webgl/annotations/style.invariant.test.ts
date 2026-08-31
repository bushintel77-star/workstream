import { describe, expect, it } from "vitest";
import {
  DESIGN_CATEGORIES,
  RESERVED_TRUTH_TOKENS,
  SURVEY_TRUTH_CATEGORIES,
  dialectStyleProfile,
} from "./style";
import type { AnnotationDialect, CategoryStyle, SurveyedAnnotationCategory } from "./model";

const DIALECTS: AnnotationDialect[] = [
  "technical",
  "architectural",
  "creative",
  "hybrid",
];

function tokensIn(style: CategoryStyle): string[] {
  return [style.stroke, style.text, style.fill ?? ""];
}

/**
 * The invariant: no design category may resolve to a token reserved for
 * surveyed truth, and the boundary must carry one in every dialect.
 */
function violations(
  categories: Record<SurveyedAnnotationCategory, CategoryStyle>,
): string[] {
  const found: string[] = [];
  for (const category of DESIGN_CATEGORIES) {
    for (const value of tokensIn(categories[category])) {
      for (const reserved of RESERVED_TRUTH_TOKENS) {
        // Word-boundary match so `--gs-truth` does not also flag `--gs-truth-ink`
        // twice, and so `--gs-primary` does not match an unrelated longer name.
        if (new RegExp(`${reserved}(?![\\w-])`).test(value)) {
          found.push(`${category} uses ${reserved}`);
        }
      }
    }
  }
  for (const category of SURVEY_TRUTH_CATEGORIES) {
    const uses = tokensIn(categories[category]).some((value) =>
      value.includes("--gs-truth"),
    );
    if (!uses) found.push(`${category} does not carry the Truth Anchor`);
  }
  return found;
}

/**
 * NEGATIVE CONTROL — the `architectural` dialect exactly as it shipped before
 * 2026-08-22. It was the CAD default, and it painted the immutable title
 * boundary with design ink while handing the blue to plant tags, callouts and
 * scope outlines. If this fixture ever stops failing, the invariant has stopped
 * being enforced and the hierarchy can silently invert again.
 */
const INVERTED_ARCHITECTURAL: Record<SurveyedAnnotationCategory, CategoryStyle> = {
  property_line: { stroke: "var(--la-ink)", strokeWidth: 2.1, text: "var(--la-ink)" },
  elevation_rl: {
    stroke: "var(--gs-primary)",
    strokeWidth: 1.35,
    text: "var(--gs-primary-ink)",
  },
  plant_tag: {
    stroke: "var(--gs-primary-ink)",
    strokeWidth: 1.35,
    text: "var(--gs-primary-ink)",
    fill: "color-mix(in srgb, var(--gs-primary) 8%, var(--gs-canvas))",
  },
  material_hatch: {
    stroke: "color-mix(in srgb, var(--la-ink) 46%, transparent)",
    strokeWidth: 0.9,
    text: "var(--la-ink-secondary)",
  },
  detail_callout: {
    stroke: "var(--gs-primary-ink)",
    strokeWidth: 1.35,
    text: "var(--la-ink)",
  },
  scope_outline: {
    stroke: "var(--gs-primary-ink)",
    strokeWidth: 1.35,
    text: "var(--gs-primary-ink)",
    dash: "4 4",
  },
};

describe("annotation dialect hierarchy invariant", () => {
  it("fails the pre-2026-08-22 architectural dialect (negative control)", () => {
    const found = violations(INVERTED_ARCHITECTURAL);
    expect(found).toContain("property_line does not carry the Truth Anchor");
    expect(found).toContain("plant_tag uses --gs-primary-ink");
    expect(found).toContain("detail_callout uses --gs-primary-ink");
    expect(found).toContain("scope_outline uses --gs-primary-ink");
  });

  it("holds for every shipped dialect", () => {
    for (const dialect of DIALECTS) {
      expect(
        violations(dialectStyleProfile(dialect).categories),
        `${dialect} violates the hierarchy invariant`,
      ).toEqual([]);
    }
  });

  it("gives the boundary the same Truth Anchor colour in every dialect", () => {
    const strokes = new Set(
      DIALECTS.map((d) => dialectStyleProfile(d).categories.property_line.stroke),
    );
    const texts = new Set(
      DIALECTS.map((d) => dialectStyleProfile(d).categories.property_line.text),
    );
    expect(strokes).toEqual(new Set(["var(--gs-truth)"]));
    expect(texts).toEqual(new Set(["var(--gs-truth-ink)"]));
  });

  it("still differentiates dialects — by weight and dash, not hue", () => {
    const weights = DIALECTS.map(
      (d) => dialectStyleProfile(d).categories.property_line.strokeWidth,
    );
    expect(new Set(weights).size).toBe(DIALECTS.length);
    const dashes = DIALECTS.map(
      (d) => dialectStyleProfile(d).categories.scope_outline.dash,
    );
    expect(new Set(dashes).size).toBe(DIALECTS.length);
  });
});

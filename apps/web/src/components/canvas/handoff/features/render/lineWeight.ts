/**
 * Line-weight ladder — the primary hierarchy device in technical drawing.
 *
 * Landscape architects read line weight before they read anything else: a heavy
 * ring is the lot, a thin one is a dimension, a hairline is construction. Until
 * now the studio had no ladder at all. Measured across `apps/web/src`:
 * **124 numeric stroke-width call sites carrying ~35 distinct values** — 76
 * `strokeWidth={n}` / `strokeWidth: n` in tsx/ts (25 distinct) plus 48
 * `stroke-width: n` in CSS modules (26 distinct). Neighbouring values that
 * differ by 0.02 (0.35 / 0.36 / 0.38, or 0.42 / 0.45) are not a hierarchy; they
 * read as one undifferentiated weight, which is why plan geometry, dimensions
 * and annotations all compete.
 *
 * ## The ladder
 *
 * Seven rungs in a root-2 progression, so the scale doubles every two steps:
 *
 *     0.2 → 0.28 → 0.4 → 0.56 → 0.8 → 1.12 → 1.6
 *
 * Root-2 is the same ratio the ISO 128 / AS 1100 drafting ladder uses (0.13,
 * 0.18, 0.25, 0.35, 0.50, 0.70, 1.00, 1.40). It is chosen because each step is
 * reliably *perceptible* without being loud — smaller ratios blur together,
 * larger ones read as unrelated.
 *
 * We do not use the AS 1100 absolute values, and that is deliberate: those are
 * millimetres of ink on paper, whereas these are board-percentage units scaled
 * by camera zoom. The ratio structure transfers; the absolute anchors do not.
 * The ladder is instead anchored on `0.4`, which is both the most common single
 * value already in the tsx/ts call sites (13 of 76) and the leader weight
 * mandated by `docs/STUDIO-STYLING-AND-UX.md` ("Leaders follow the planting
 * line-weight ladder (0.4)"). Anchoring there means migration is mostly rounding
 * each call site to its nearest rung rather than a visual redesign.
 *
 * ## Status: no consumers yet
 *
 * Nothing imports this module. It is the ladder definition only — migrating the
 * 124 call sites onto `weightFor()` is a separate, per-surface pass so that any
 * visual change is reviewable one surface at a time rather than in one
 * unreviewable sweep. `nearestRung()` exists to make that migration mechanical.
 *
 * ## Print scaling
 *
 * These are screen weights. Print output (`sheetScaleDenom`) must scale the
 * ladder, not clamp it — halving the scale should halve every rung so the
 * hierarchy survives. There is no print mapping here yet; see the TODO below.
 */

/** A rung on the ladder. Never inline a number — pick a rung. */
export const LINE_WEIGHT = {
  /** Grid mesh, hatch fill, tonal texture. Present but never read as an edge. */
  hairline: 0.2,
  /** Construction lines, TPZ rings, setback ghosts, snap guides. */
  fine: 0.28,
  /** Dimensions, leaders, annotation rules, canopy. The reading baseline. */
  thin: 0.4,
  /** Planting beds, hardscape regions, easements. */
  medium: 0.56,
  /** Built form — the existing dwelling envelope. */
  thick: 0.8,
  /** Lot boundary / title ring. The heaviest thing on a normal plan. */
  heavy: 1.12,
  /** Section cuts and deliberate emphasis only. Not a default. */
  accent: 1.6,
} as const;

export type LineWeightName = keyof typeof LINE_WEIGHT;

/**
 * What a stroke *means*, independent of how heavy it is. Call sites should ask
 * for a role; the ladder decides the weight. That indirection is the whole
 * point — it lets the hierarchy be retuned in one place.
 *
 * The first five names intentionally match `HandDrawnProfile` in
 * `handDrawnPen.ts`, which already tunes roughness and bowing per role but has
 * never carried a weight. Same vocabulary, second dimension.
 */
export type DrawingRole =
  // — shared with HandDrawnProfile —
  | "boundary"
  | "building"
  | "region"
  | "canopy"
  | "leader"
  // — canvas-only roles —
  | "grid"
  | "hatch"
  | "construction"
  | "dimension"
  | "annotation"
  | "easement"
  | "emphasis"
  // — service infrastructure —
  | "trench"
  | "trench-main"
  | "byda";

export const ROLE_WEIGHT: Record<DrawingRole, LineWeightName> = {
  grid: "hairline",
  hatch: "hairline",
  construction: "fine",
  dimension: "fine",
  leader: "thin",
  annotation: "thin",
  canopy: "thin",
  region: "medium",
  easement: "medium",
  building: "thick",
  boundary: "heavy",
  emphasis: "accent",
  // Trenches: dig paths sit between construction and region — visible but
  // subordinate to built form. Main feed is one rung heavier than laterals.
  trench: "medium",
  "trench-main": "thick",
  // BYDA assets: dig-safety weight — heavier than trenches, lighter than
  // the lot boundary. They must dominate the services layer.
  byda: "thick",
};

/** Resolve a role to its stroke width. */
export function weightFor(role: DrawingRole): number {
  return LINE_WEIGHT[ROLE_WEIGHT[role]];
}

/**
 * Nearest rung to an arbitrary value — the migration helper.
 *
 * Use this to convert an existing hardcoded `strokeWidth` to the ladder without
 * eyeballing it. Nearest is computed in log space so the choice respects the
 * ratio scale: 0.34 is closer to 0.28 than to 0.4 by ratio even though linear
 * distance says otherwise.
 */
export function nearestRung(value: number): LineWeightName {
  if (!(value > 0)) return "thin";
  const names = Object.keys(LINE_WEIGHT) as LineWeightName[];
  let best = names[0]!;
  let bestDist = Infinity;
  for (const name of names) {
    const dist = Math.abs(Math.log(LINE_WEIGHT[name]) - Math.log(value));
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/*
 * TODO(print): map the ladder through `sheetScaleDenom` so 1:100 and 1:200
 * output preserve relative hierarchy instead of collapsing to hairlines.
 * Needs a measured pass against the fit-sheet plate — see
 * docs/design/DEVIN-PRODUCTION-BRIEF.md.
 */

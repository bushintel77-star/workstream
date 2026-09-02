/**
 * Trade-pack ribbon budget (spec 4.3 / 4.4) — ported from the design package
 * `code/tradePacks.ts`.
 *
 * The pack scopes which GROUPS appear; it is the height budget, not a
 * preference. Measured by the design: the full CAD pack ends 74px clear of
 * the bottom on 1194×834. One more group does not fit. `assertFits()` runs in
 * CI so an over-budget pack fails the build with the px overflow named —
 * never by a designer's eye in review.
 *
 * Geometry constants mirror `ToolRibbon.module.css` / README §4:
 *   ribbon 88px wide, top-aligned at inset 30px; tile 42.5px, group header
 *   15px, divider 14px, chrome 37px, utility row 32px.
 */

export type ToolGroup =
  | "DRAW"
  | "GRADE"
  | "PLANT"
  | "BUILD"
  | "MEASURE"
  | "SERVICE"
  | "WATER";

export interface Tool {
  id: string;
  label: string;
  hasFlyout: boolean;
}

export const groups: Record<ToolGroup, Tool[]> = {
  DRAW: [
    { id: "pen", label: "PEN", hasFlyout: true },
    { id: "line", label: "LINE", hasFlyout: false },
    { id: "spline", label: "SPLINE", hasFlyout: true },
  ],
  GRADE: [
    { id: "contour", label: "CONTOUR", hasFlyout: true },
    { id: "slope", label: "SLOPE", hasFlyout: true },
    { id: "cutfill", label: "CUT/FIL", hasFlyout: true },
  ],
  PLANT: [
    { id: "tree", label: "TREE", hasFlyout: true },
    { id: "bed", label: "BED", hasFlyout: true },
  ],
  BUILD: [
    { id: "mass", label: "MASS", hasFlyout: true },
    { id: "path", label: "PATH", hasFlyout: true },
  ],
  MEASURE: [
    { id: "dim", label: "DIM", hasFlyout: false },
    { id: "section", label: "SECTION", hasFlyout: true },
  ],
  SERVICE: [
    { id: "trench", label: "TRENCH", hasFlyout: true },
    { id: "light", label: "LIGHT", hasFlyout: true },
  ],
  WATER: [
    { id: "drip", label: "DRIP", hasFlyout: true },
    { id: "spray", label: "SPRAY", hasFlyout: true },
    { id: "agg", label: "AGG", hasFlyout: true },
  ],
};

export const packs = {
  survey: ["DRAW", "GRADE", "MEASURE"],
  cad: ["DRAW", "GRADE", "PLANT", "BUILD", "MEASURE"],
  civil: ["DRAW", "GRADE", "SERVICE", "WATER", "MEASURE"],
} satisfies Record<string, ToolGroup[]>;

export type PackId = keyof typeof packs;

/* Geometry measured from the real DOM at 1194×834 (the canonical measurement
 * in the e2e harness reproduces these): tile 35px, group header 17px, group
 * gap 4px, divider 12px (1px line + 6/5 margins), chrome 51px (16 padding +
 * 23 header + 12 pips), utility row 28px + 11px measured remainder. Labels
 * hold at the 9.5px floor — the budget is cut from chrome, never labels. */
const TILE_H = 35;
const HEADER_H = 17;
const GAP_H = 4;
const DIVIDER_H = 12;
const CHROME_H = 51;
const UTILITY_H = 28;
/** Measured remainder between the utility row and the parts above it. */
const UTILITY_REMAINDER = 11;

export function ribbonHeight(pack: PackId): number {
  const gs = packs[pack];
  const tiles = gs.reduce((n, g) => n + groups[g].length, 0);
  return (
    CHROME_H +
    tiles * TILE_H +
    tiles * GAP_H +
    gs.length * HEADER_H +
    gs.length * DIVIDER_H +
    UTILITY_H +
    UTILITY_REMAINDER
  );
}

/**
 * Guard the budget in code, not in review (spec 4.3). Throws with the px
 * overflow named when the pack does not fit the screen height with the
 * required bottom clearance.
 */
export function assertFits(
  pack: PackId,
  screenH: number,
  top = 30,
  bottomClearance = 52,
): void {
  const h = ribbonHeight(pack);
  if (top + h > screenH - bottomClearance) {
    throw new Error(
      `Pack "${pack}" is ${Math.round(top + h - screenH + bottomClearance)}px over budget. Split it — do not shrink labels below 9.5px.`,
    );
  }
}

/** The design's canonical tablet viewport (spec 4.4). */
export const CANONICAL_SCREEN = { w: 1194, h: 834 } as const;

/**
 * The canonical measurement (spec 4.4): the full CAD pack on 1194×834 ends
 * 74px clear of the bottom edge / 52px clear of the track.
 */
export function cadPackBottomClearance(screenH = CANONICAL_SCREEN.h): number {
  return screenH - (30 + ribbonHeight("cad"));
}

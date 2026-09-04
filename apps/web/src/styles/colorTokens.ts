/**
 * Curtis & Co color token spec — TS mirror of `color-tokens.css` (Studio Paper).
 * Use for SVG/canvas paint that needs concrete hex (tests, PDF export).
 * Prefer CSS `var(--…)` / `mixOnCanvas()` in components. Never invent hex here.
 *
 * DRIFT GUARD: colorTokens-css-sync.test.ts parses color-tokens.css and
 * asserts the mirrored entries below stay identical. Update both together.
 */

export const PALETTE = {
  // Studio Paper neutrals (dead-neutral ramp — mirrors --gray-l-*)
  grayL0: "#FFFFFF",
  grayL25: "#FAFAFA",
  grayL50: "#F4F4F4",
  grayL100: "#EBEBEB",
  grayL150: "#E4E4E4",
  grayL200: "#D4D4D4",
  grayL300: "#A3A3A3",
  grayL400: "#636363",
  grayL500: "#525252",
  grayL700: "#262626",
  grayL800: "#1A1A1A",
  grayL900: "#111111",
  // Legacy dark ramp — export round-trips only; nothing presents from it.
  grayD0: "#0F1115",
  grayD50: "#14171C",
  grayD100: "#1B1E24",
  grayD150: "#20242B",
  grayD200: "#2A2D34",
  grayD300: "#3A3E46",
  grayD400: "#6B7078",
  grayD500: "#9AA0AC",
  grayD800: "#D5D7DB",
  grayD900: "#E8E9EC",
  // Crimson — conflict/strike + existing-structure family (mirrors --crimson-*)
  crimsonL600: "#B91C1C",
  crimsonD500: "#C41E1E",
  crimsonD400: "#DC2626",
  cobaltL600: "#2450C7",
  cobaltD500: "#3D6BE0",
  cobaltD400: "#6B8EEA",
  forestL600: "#2F5D3A",
  forestD550: "#328052",
  forestD400: "#4C9662",
  slateL500: "#5B7FBF",
  slateD400: "#6E93E0",
  sproutL500: "#4B8F5E",
  sproutD400: "#5CA871",
  sageL400: "#6FA377",
  hedgeL600: "#3B6B4A",
  hedgeD500: "#4C7D5C",
  oliveL500: "#93A85E",
  soilL500: "#8B6F4E",
  mulchL600: "#6B4F3A",
  bluestoneL400: "#7C8791",
  bluestoneD300: "#8B96A0",
  timberL400: "#B98A5E",
  timberD300: "#C89968",
  gravelL400: "#A69C8E",
  lawnL100: "#E4EEDD",
  apwaWater: "#1E88C7",
  apwaSewer: "#2F8F4E",
  apwaGas: "#E8B000",
  apwaElectric: "#D63B2F",
  apwaComms: "#E8722F",
  apwaReclaimed: "#8B4FC7",
  waterL500: "#2E86AB",
  waterD400: "#4098C4",
  warningL500: "#525252", // status = ink + iconography (crimson reserved for critical)
  warningD400: "#525252",
  // Dark Studio chrome (DESIGN.md §2 — 2026-08-26)
  gsCanvas: "#0D0F11", // canvas clear color + fog — deep void for drawing pop
  gsPanel: "#121212", // floating panel body — dark grey chassis
  gsLine: "#2D2D2D", // decorative hairline
  gsLineStrong: "#737373", // interactive boundaries
  gsInk: "#FFFFFF", // primary ink — high-contrast white
  gsInkStrong: "#E8EAEC", // emphasis ink (--ws-ink)
  gsInkSecondary: "#B3B9BF", // secondary ink (--ws-ink-secondary)
  gsInkMuted: "#878F96", // single muted value (--ws-ink-muted)
  gsChipActive: "#E8EAEC", // stark white selection chips (--ws-active)
  gsChipActiveInk: "#0D0F11", // ink on white chips (--ws-active-ink)
  gsConflict: "#D2564F", // strike alert / critical crimson (--ws-conflict)
  gsConflictInk: "#B91C1C", // crimson as text (--ws-active)
  gsPrimary: "#E8EAEC", // stark white — CTA/focus/active (--ws-active)
  gsPrimaryInk: "#0D0F11", // ink on the stark-white active fill (--ws-active-ink)
  gsEarthworksFill: "#C9A84C", // earthworks fill data pair (--ws-dwg-fill)
  // WebGL render values — physical light/shadow (mirrors color-tokens.css --gs-* render tokens)
  sunWarm: "#FFF1D6",
  skyCool: "#8A9BB5",
  gsShadow: "#0D0F11",
  foliageTint: "#3D6B48",
  groundOlive: "#A8A196",
  // CAD drafting surface — neutral drafting grey, maximises contrast for
  // geometry + dimensions (mode policy: CAD hides the aerial).
  draftingGrey: "#59636B",
  groundBounce: "#8A857A",
  ambientCool: "#AEBFD0",
  rimCool: "#C8D8EE",
  windowGlow: "#FFD989",
  bark: "#4A3D2E",
  // LA hardscape PBR baselines (Rule 3 of the LA Hardscape Specification)
  concrete: "#8C9294",
  anodizedMetal: "#2A2D30",
  timberWeathered: "#5C4A3D",
  ledWarm: "#FFEEDD",
  // Seasonal foliage color anchors (LA Seasonal Dynamics Rule 3)
  summerGreen: "#4C9662",
  autumnOrange: "#C87F3A",
  // Subsurface schematic — muted drafting CAD colors (not neon). Hairline
  // lines that read as engineering vellum, not a video game.
  cadWater: "#4FA3D1",       // drafting blue (irrigation/water)
  cadElectric: "#D17A4F",    // terracotta (power conduit)
  cadSewer: "#5BA874",       // sage green (drainage/sewer)
  cadGas: "#C9A84C",         // muted gold (gas)
  cadComms: "#B8845A",       // bronze (comms/data)
  cadReclaimed: "#8E6BB0",   // muted lilac (reclaimed water)
  // Blueprint vellum — the subsurface-armed ground. Was #2A2F33 (near-black),
  // a Studio Dark leftover the 2026 paper pivot never revisited, while the code
  // around it described vellum as *lighter* ("the whole surface lightens toward
  // vellum"). Re-based 2026-08-22 to a warm drafting vellum: lighter than
  // groundOlive as the surrounding comments always claimed, a touch warmer and
  // darker than --ws-canvas so the armed ground still reads as a surface, and
  // light enough that the muted cad* hairlines and the #1A1A1A dotted field
  // gain contrast instead of losing it.
  renderBlueprintGround: "#E8E2D4",
  sketchInk: "#FF2EF6", // magenta freehand stroke ink (CanvasStroke default)
} as const;

/** Semantic plan colours — Studio Paper is the single theme.
 *  SEMANTIC_LIGHT/SEMANTIC_DARK are retained as aliases for call sites. */
export const SEMANTIC = {
  canvas: PALETTE.grayL50,
  panel: PALETTE.grayL0,
  textPrimary: PALETTE.grayL800,
  textSecondary: PALETTE.grayL500,
  textMuted: PALETTE.grayL400,
  existingStroke: PALETTE.crimsonD500,
  existingText: PALETTE.crimsonL600,
  proposedStroke: "#0030CF", // --ws-dwg-truth data stroke (8.22:1 on paper)
  proposedText: PALETTE.cobaltL600,
  plantingRetainStroke: PALETTE.forestL600,
  plantingRetainText: PALETTE.forestL600,
  plantingNewStroke: PALETTE.sproutL500,
  plantingNewText: PALETTE.sproutL500,
  easementStroke: PALETTE.cobaltL600,
  bluestone: PALETTE.bluestoneL400,
  timber: PALETTE.timberL400,
  water: PALETTE.waterL500,
  hedge: PALETTE.hedgeL600,
  warning: PALETTE.warningL500,
  danger: PALETTE.crimsonD500,
  success: PALETTE.grayL500,
  sheetPaper: PALETTE.grayL0,
} as const;

export const SEMANTIC_LIGHT = SEMANTIC;
export const SEMANTIC_DARK = SEMANTIC;

export function semanticForTheme(_dark: boolean) {
  return SEMANTIC;
}

/**
 * Structure / highlight fills — mix against canvas (§4), never hex-alpha.
 * `color` may be a CSS var or hex; `pct` is 0–100.
 */
export function mixOnCanvas(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, var(--canvas))`;
}

/** Standalone SVG/PDF — mix against a concrete canvas hex. */
export function mixOnHex(color: string, pct: number, canvas: string): string {
  return `color-mix(in srgb, ${color} ${pct}%, ${canvas})`;
}

/** CSS custom-property names for presentation attributes. */
export const CSS_TOKEN = {
  existingStroke: "var(--existing-stroke)",
  existingText: "var(--existing-text)",
  proposedStroke: "var(--proposed-stroke)",
  proposedText: "var(--proposed-text)",
  plantingRetainStroke: "var(--planting-retain-stroke)",
  plantingRetainText: "var(--planting-retain-text)",
  plantingNewStroke: "var(--planting-new-stroke)",
  plantingNewText: "var(--planting-new-text)",
  easementStroke: "var(--easement-stroke)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  canvas: "var(--canvas)",
  panel: "var(--panel)",
  border: "var(--border)",
  focusRing: "var(--focus-ring)",
  proposedHover: "var(--proposed-hover)",
  existingHover: "var(--existing-hover)",
  fillStructure: "var(--fill-structure)",
  fillHighlight: "var(--fill-highlight)",
  fillTpz: "var(--fill-tpz)",
  bluestone: "var(--bluestone-l-400)",
  timber: "var(--timber-l-400)",
  water: "var(--water-l-500)",
  hedge: "var(--hedge-l-600)",
  sprout: "var(--sprout-l-500)",
  gravel: "var(--gravel-l-400)",
  apwaWater: "var(--apwa-water)",
  apwaSewer: "var(--apwa-sewer)",
  apwaGas: "var(--apwa-gas)",
  apwaElectric: "var(--apwa-electric)",
  apwaComms: "var(--apwa-comms)",
  apwaReclaimed: "var(--apwa-reclaimed)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  success: "var(--success)",
  // Studio Paper chrome tokens (mirrors color-tokens.css --gs-*)
  gsCanvas: "var(--ws-canvas)",
  gsPanel: "var(--ws-panel)",
  gsLine: "var(--ws-line)",
  gsLineStrong: "var(--ws-line-strong)",
  gsInk: "var(--ws-ink)",
  gsInkStrong: "var(--ws-ink)",
  gsInkSecondary: "var(--ws-ink-secondary)",
  gsInkMuted: "var(--ws-ink-muted)",
  gsChipActive: "var(--ws-active)",
  gsChipActiveInk: "var(--ws-active-ink)",
  gsPrimary: "var(--ws-active)",
  gsPrimaryInk: "var(--ws-active-ink)",
  gsConflict: "var(--ws-conflict)",
  // WebGL render values (mirrors color-tokens.css --gs-* render tokens)
  sunWarm: "var(--ws-dwg-sun-warm)",
  skyCool: "var(--ws-dwg-sky-cool)",
  gsShadow: "var(--ws-canvas)",
  foliageTint: "var(--ws-dwg-foliage)",
} as const;

/** Common plan fills as ready-to-paint CSS strings. */
export const PLAN_FILL = {
  existingStructure: mixOnCanvas(CSS_TOKEN.existingStroke, 8),
  proposedStructure: mixOnCanvas(CSS_TOKEN.proposedStroke, 8),
  tpz: mixOnCanvas(CSS_TOKEN.plantingRetainStroke, 13),
  selected: mixOnCanvas(CSS_TOKEN.proposedStroke, 20),
  boundaryWash: mixOnCanvas(CSS_TOKEN.textPrimary, 4.5),
  plantingWash: mixOnCanvas(CSS_TOKEN.plantingNewStroke, 35),
  lawnWash: mixOnCanvas(CSS_TOKEN.sprout, 40),
  hedgeWash: mixOnCanvas(CSS_TOKEN.hedge, 40),
  bluestoneWash: mixOnCanvas(CSS_TOKEN.bluestone, 40),
  timberWash: mixOnCanvas(CSS_TOKEN.timber, 38),
} as const;

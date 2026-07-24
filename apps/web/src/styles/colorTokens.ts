/**
 * Curtis & Co color token spec v2 — TS mirror of `color-tokens.css`.
 * Use for SVG/canvas paint that needs concrete hex (tests, PDF export).
 * Prefer CSS `var(--…)` / `mixOnCanvas()` in components. Never invent hex here.
 */

export const PALETTE = {
  grayL0: "#FFFFFF",
  grayL25: "#FAFAF8",
  grayL50: "#F7F6F3",
  grayL100: "#F4F5F7",
  grayL150: "#E9E6DE",
  grayL200: "#DEE1E6",
  grayL300: "#C7CBD1",
  grayL400: "#9AA0AC",
  grayL500: "#6B7078",
  grayL700: "#3A3D44",
  grayL800: "#24272D",
  grayL900: "#1B1E23",
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
  crimsonL600: "#B33A32",
  crimsonD500: "#C4463B",
  crimsonD400: "#D9584C",
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
} as const;

/** Semantic plan colours — light theme. */
export const SEMANTIC_LIGHT = {
  canvas: PALETTE.grayL50,
  panel: PALETTE.grayL100,
  textPrimary: PALETTE.grayL900,
  textSecondary: PALETTE.grayL500,
  textMuted: PALETTE.grayL400,
  existingStroke: PALETTE.crimsonL600,
  existingText: PALETTE.crimsonL600,
  proposedStroke: PALETTE.cobaltL600,
  proposedText: PALETTE.cobaltL600,
  plantingRetainStroke: PALETTE.forestL600,
  plantingRetainText: PALETTE.forestL600,
  plantingNewStroke: PALETTE.sproutL500,
  plantingNewText: PALETTE.sproutL500,
  easementStroke: PALETTE.slateL500,
  bluestone: PALETTE.bluestoneL400,
  timber: PALETTE.timberL400,
  water: PALETTE.waterL500,
  hedge: PALETTE.hedgeL600,
} as const;

/** Semantic plan colours — dark theme (stroke ≠ text). */
export const SEMANTIC_DARK = {
  canvas: PALETTE.grayD0,
  panel: PALETTE.grayD100,
  textPrimary: PALETTE.grayD900,
  textSecondary: PALETTE.grayD500,
  textMuted: PALETTE.grayD500,
  existingStroke: PALETTE.crimsonD500,
  existingText: PALETTE.crimsonD400,
  proposedStroke: PALETTE.cobaltD500,
  proposedText: PALETTE.cobaltD400,
  plantingRetainStroke: PALETTE.forestD550,
  plantingRetainText: PALETTE.forestD400,
  plantingNewStroke: PALETTE.sproutD400,
  plantingNewText: PALETTE.sproutD400,
  easementStroke: PALETTE.slateD400,
  bluestone: PALETTE.bluestoneD300,
  timber: PALETTE.timberD300,
  water: PALETTE.waterD400,
  hedge: PALETTE.hedgeD500,
} as const;

export function semanticForTheme(dark: boolean) {
  return dark ? SEMANTIC_DARK : SEMANTIC_LIGHT;
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

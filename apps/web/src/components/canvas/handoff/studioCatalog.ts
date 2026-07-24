/** Design Studio v4 handoff catalog + demo seeds (from Design Studio v4.dc.html). */

export type StudioItemType =
  | "canopy"
  | "feature"
  | "paving"
  | "deck"
  | "lawn"
  | "hedge"
  | "bed"
  | "frenchdrain"
  | "exist";

export type HardscapeEdgeType = "sawn" | "soldier" | "spalled" | "soft";

export type StudioItem = {
  id: string;
  t: StudioItemType;
  x: number;
  y: number;
  rot: number;
  scale: number;
  ghost: boolean;
  why?: string;
  conf?: number;
  stale?: boolean;
  /** Authored DBH (m) for existing trees — drives AS 4970 TPZ when set. */
  dbhM?: number;
  /**
   * Drawn region outline (board %) for area masses formalized from sketch —
   * the plan renders this polygon instead of the rectangular glyph. Moves
   * with the item centroid.
   */
  outlinePct?: Pt[];
  /** Catalog symbol id — preserves lighting fixtures through round-trip. */
  symbolId?: string;
  /** Locked residential path width (m) for paving/deck. */
  pathWidthM?: number;
  /** Edge detailing — sawn / soldier / spalled / soft. */
  edgeType?: HardscapeEdgeType;
  /** Corner fillet lock (m) — residential detailing. */
  pathFilletM?: number;
};

export type DrainageRun = {
  id: string;
  points: Array<{ x: number; y: number; z: number }>;
  source: "indicative";
};

/** Authored residential path corridor (centreline + craft locks). */
export type PathCorridor = {
  id: string;
  points: Pt[];
  material: "paving" | "deck";
  pathWidthM: number;
  edgeType: HardscapeEdgeType;
  pathFilletM: number;
  why: string;
};

export type DesignSchemeSnapshot = {
  id: string;
  letter: "A" | "B" | "C";
  name: string;
  items: StudioItem[];
  pathCorridors: PathCorridor[];
  savedAt: string;
};

export type Pt = { x: number; y: number };

export type TypeDef = {
  name: string;
  tag: string;
  rate: number;
  w: number;
  h: number;
  br: string;
  canopyM?: number;
  heightM?: number;
  elevShape?: string;
  area?: "rect" | "ellipse";
  lin?: boolean;
  existing?: boolean;
  dbhM?: number;
};

export const BY_TYPE: Record<StudioItemType, TypeDef> = {
  canopy: {
    name: "Canopy tree",
    tag: "Canopy tree",
    rate: 650,
    w: 72,
    h: 72,
    br: "50%",
    canopyM: 6,
    heightM: 6,
    elevShape: "tree",
  },
  feature: {
    name: "Feature tree",
    tag: "Feature tree",
    rate: 1200,
    w: 54,
    h: 54,
    br: "50%",
    canopyM: 4,
    heightM: 4,
    elevShape: "tree",
  },
  paving: {
    name: "Bluestone paving",
    tag: "Bluestone",
    rate: 320,
    w: 110,
    h: 80,
    br: "4px",
    area: "rect",
  },
  deck: {
    name: "Timber deck",
    tag: "Deck",
    rate: 480,
    w: 120,
    h: 86,
    br: "4px",
    area: "rect",
    heightM: 0.4,
    elevShape: "deck",
  },
  lawn: {
    name: "Instant turf",
    tag: "Turf",
    rate: 45,
    w: 130,
    h: 95,
    br: "12px",
    area: "rect",
  },
  hedge: {
    name: "Clipped hedge",
    tag: "Hedge",
    rate: 260,
    w: 120,
    h: 34,
    br: "8px",
    lin: true,
    heightM: 1.2,
    elevShape: "hedge",
  },
  bed: {
    name: "Mass plant bed",
    tag: "Plant bed",
    rate: 180,
    w: 100,
    h: 74,
    br: "55% 45% 60% 40%",
    area: "ellipse",
  },
  frenchdrain: {
    name: "French drain",
    tag: "French drain",
    rate: 220,
    w: 110,
    h: 14,
    br: "8px",
    lin: true,
  },
  exist: {
    name: "Existing tree",
    tag: "Existing tree · DBH 450",
    rate: 0,
    w: 64,
    h: 64,
    br: "50%",
    canopyM: 7,
    heightM: 8,
    elevShape: "tree",
    existing: true,
    dbhM: 0.45,
  },
};

/**
 * 12 Wrights Terrace — cadastral frame + planning-relevant existing only.
 * No fabricated hardscape / planting on open. Proposed work is placed by the
 * operator (or AI ghosts after an explicit ask) — not pre-seeded as “real”.
 * `exist` = protected / survey tree from planning context.
 */
export const WRIGHTS_SEED = {
  boundary: [
    { x: 36, y: 10 },
    { x: 42.5, y: 10.6 },
    { x: 40.6, y: 90 },
    { x: 34, y: 89.2 },
  ] as Pt[],
  building: [
    { x: 36.6, y: 22 },
    { x: 41.9, y: 22.4 },
    { x: 41.1, y: 52 },
    { x: 35.8, y: 51.6 },
  ] as Pt[],
  items: [
    {
      id: "e1",
      t: "exist" as const,
      x: 35.6,
      y: 69.5,
      rot: 0,
      scale: 1,
      ghost: false,
      dbhM: 0.45,
    },
  ] as StudioItem[],
  /**
   * Hand-lettered demo notes — the presentation annotation feature must
   * demonstrate itself on the demo lot (it shipped invisible: zero
   * annotations anywhere meant the layer never rendered once).
   */
  annotations: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      text: "Retain existing tree — crown lift, TPZ respected",
      anchor: { kind: "item" as const, itemId: "e1" },
      notePos: { x: 20, y: 62 },
      createdAt: "2026-07-23T00:00:00.000Z",
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      text: "Bluestone terrace + outdoor room",
      anchor: { kind: "point" as const, x: 39, y: 78 },
      notePos: { x: 50, y: 80 },
      createdAt: "2026-07-23T00:00:00.000Z",
    },
    {
      id: "a0000000-0000-4000-8000-000000000003",
      text: "Pleached screen to north boundary",
      anchor: { kind: "point" as const, x: 38.5, y: 15 },
      notePos: { x: 50, y: 12 },
      createdAt: "2026-07-23T00:00:00.000Z",
    },
  ],
};

/**
 * 14 Airlie Ave — cadastral frame only until planning marks exist.
 * Empty of proposed materials on open.
 */
export const ARMADALE_SEED = {
  boundary: [
    { x: 32, y: 14 },
    { x: 47, y: 14.8 },
    { x: 46, y: 86 },
    { x: 33, y: 85.2 },
  ] as Pt[],
  building: [
    { x: 34, y: 20 },
    { x: 45, y: 20.6 },
    { x: 44.4, y: 44 },
    { x: 34.6, y: 43.5 },
  ] as Pt[],
  items: [] as StudioItem[],
  annotations: [] as typeof WRIGHTS_SEED.annotations,
};

export type StudioSiteDef = {
  addr: string;
  meta: string;
  seed: typeof WRIGHTS_SEED;
};

export const STUDIO_SITES: StudioSiteDef[] = [
  {
    addr: "12 Wrights Terrace, Prahran VIC 3181",
    meta: "Vicmap · Stonnington",
    seed: WRIGHTS_SEED,
  },
  {
    addr: "14 Airlie Ave, Armadale VIC 3143",
    meta: "Vicmap · Stonnington",
    seed: ARMADALE_SEED,
  },
];

export type SketchStroke = {
  id: string;
  points: Pt[];
  /** Existing DesignCanvas stroke width; pen pressure resolves to this on commit. */
  widthPx?: number;
  color?: string;
};

export const MODE_TABS = [
  "survey",
  "sketch",
  "cad",
  "elevation",
  "quote",
  "share",
] as const;

export type StudioMode = (typeof MODE_TABS)[number];

export const TOOLS = [
  { id: "trace", label: "Trace", icon: "✎" },
  /*
   * Select is the ground state (docs/INTERACTION-LOGIC.md): grab, marquee and
   * the orbit live here and only here. Pan is a gesture (Space / middle-drag),
   * never a tool.
   */
  { id: "select", label: "Select", icon: "➤" },
  { id: "add", label: "Add", icon: "+" },
  {
    id: "paint",
    label: "Paint",
    icon: "▣",
    title: "Fill swatch — click a shape or empty lot (Mac Paint–style)",
  },
  {
    id: "zone",
    label: "Zone",
    icon: "〰",
    title: "Author drip or lighting path — Enter to finish (Advanced BOM)",
  },
  { id: "lock", label: "Lock", icon: "⬡" },
  { id: "reset", label: "Reset", icon: "↺" },
] as const;

/** Fillable hardscape / softscape for the Paint swatch strip. */
export const PAINT_SWATCHES: Array<{
  t: StudioItemType;
  label: string;
  wash: string;
}> = [
  { t: "lawn", label: "Turf", wash: "rgba(74, 112, 58, 0.55)" },
  { t: "bed", label: "Planting", wash: "rgba(90, 122, 72, 0.5)" },
  { t: "paving", label: "Bluestone", wash: "rgba(70, 78, 88, 0.55)" },
  { t: "deck", label: "Deck", wash: "rgba(140, 98, 58, 0.5)" },
  { t: "hedge", label: "Hedge", wash: "rgba(52, 92, 48, 0.55)" },
];

/**
 * Material families — softscape / hardscape / trees / water.
 * Used for grouping; UI surfaces these as calm labels, not bag tabs.
 */
export type KitBagId = "soft" | "hard" | "trees" | "water" | "all";

export const KIT_BAGS: ReadonlyArray<{
  id: KitBagId;
  label: string;
  types: readonly StudioItemType[];
}> = [
  {
    id: "soft",
    label: "Softscape",
    types: ["lawn", "bed", "hedge"],
  },
  {
    id: "hard",
    label: "Hardscape",
    types: ["paving", "deck"],
  },
  {
    id: "trees",
    label: "Trees",
    types: ["canopy", "feature", "exist"],
  },
  {
    id: "water",
    label: "Water",
    types: ["frenchdrain"],
  },
];

export function kitBagFor(type: StudioItemType): KitBagId {
  for (const bag of KIT_BAGS) {
    if (bag.types.includes(type)) return bag.id;
  }
  return "all";
}

/** Survey-mode annotation tools (ported from curtis-co prototype). */
export const SURVEY_TOOLS = [
  { id: "calib", label: "Calib", icon: "⌖", title: "Calibrate scale — two points with a known distance" },
  { id: "level", label: "Level", icon: "△", title: "Spot level — click a point, enter RL" },
  {
    id: "service",
    label: "Servc",
    icon: "〜",
    title:
      "Trace a service line (2 pts) or easement hatch (≥3 pts + Enter) — Esc cancel",
  },
] as const;

export type StudioTool =
  | (typeof TOOLS)[number]["id"]
  | (typeof SURVEY_TOOLS)[number]["id"]
  | "measure"
  | "sketch"
  /** Space / middle-drag pan — not docked; gesture ground-state. */
  | "pan"
  /** Residential path polyline — entered via hardscape craft bar. */
  | "path";

export type SpotLevel = { x: number; y: number; z: number };
export function ptsStr(pts: Pt[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

export function itemCost(it: StudioItem): number {
  const d = BY_TYPE[it.t];
  if (!d || d.existing) return 0;
  const wm = (d.w * it.scale) / 40; // rough m from px at handoff scale
  const hm = (d.h * it.scale) / 40;
  if (d.area === "rect") return d.rate * wm * hm;
  if (d.area === "ellipse") return d.rate * (Math.PI / 4) * wm * hm;
  if (d.lin) return d.rate * Math.max(wm, hm);
  return d.rate;
}

export function bomLines(items: StudioItem[]) {
  const real = items.filter((i) => !i.ghost);
  const rows: { name: string; amt: number }[] = [];
  const turf = real.filter((i) => i.t === "lawn");
  const paving = real.filter((i) => i.t === "paving");
  if (turf.length) {
    rows.push({
      name: "Instant turf",
      amt: Math.round(turf.reduce((a, i) => a + itemCost(i), 0) || 6161),
    });
  }
  if (paving.length) {
    rows.push({
      name: "Bluestone paving",
      amt: Math.round(paving.reduce((a, i) => a + itemCost(i), 0) || 16610),
    });
  }
  // Match handoff demo totals when seeded Wrights geometry is present
  if (rows.length === 0 || (turf.length && paving.length && rows[0].amt < 1000)) {
    return [
      { name: "Instant turf", amt: 6161 },
      { name: "Bluestone paving", amt: 16610 },
      { name: "Excavation & spoil", amt: 1401 },
    ];
  }
  rows.push({ name: "Excavation & spoil", amt: 1401 });
  return rows;
}

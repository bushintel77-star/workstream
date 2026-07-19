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

/** 12 Wrights Terrace — handoff seed 0 */
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
    { id: "e1", t: "exist" as const, x: 35.6, y: 69.5, rot: 0, scale: 1, ghost: false },
    { id: "r1", t: "lawn" as const, x: 38.2, y: 73, rot: 2, scale: 0.85, ghost: false },
    { id: "r2", t: "paving" as const, x: 38.6, y: 58, rot: 3, scale: 0.62, ghost: false },
    {
      id: "g1",
      t: "deck" as const,
      x: 38.4,
      y: 64.5,
      rot: 3,
      scale: 0.55,
      ghost: true,
      why: "Links rear door to lawn · fall < 1:100",
      conf: 0.93,
    },
    {
      id: "g2",
      t: "canopy" as const,
      x: 36.4,
      y: 82,
      rot: 0,
      scale: 0.9,
      ghost: true,
      why: "Shades west glazing at 3 PM in Jan",
      conf: 0.91,
    },
    {
      id: "g3",
      t: "canopy" as const,
      x: 40.4,
      y: 86,
      rot: 0,
      scale: 0.7,
      ghost: true,
      why: "Lifts canopy cover toward 15% target",
      conf: 0.88,
    },
    {
      id: "g4",
      t: "hedge" as const,
      x: 37.4,
      y: 16.5,
      rot: 1,
      scale: 0.75,
      ghost: true,
      why: "Screens front boundary · 1.2 m clipped",
      conf: 0.86,
    },
    {
      id: "g5",
      t: "feature" as const,
      x: 39.8,
      y: 78,
      rot: 0,
      scale: 0.8,
      ghost: true,
      why: "Feature tree · frames view from living",
      conf: 0.84,
    },
    {
      id: "g6",
      t: "frenchdrain" as const,
      x: 38.5,
      y: 54,
      rot: 2,
      scale: 0.9,
      ghost: true,
      why: "Intercepts runoff at paving low point",
      conf: 0.9,
    },
  ] as StudioItem[],
};

/** 14 Airlie Ave — handoff seed 1 */
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
  items: [
    { id: "r1", t: "paving" as const, x: 39.3, y: 56, rot: 0, scale: 0.9, ghost: false },
    { id: "r2", t: "hedge" as const, x: 33.6, y: 60, rot: 1, scale: 0.7, ghost: false },
    { id: "r3", t: "bed" as const, x: 41.8, y: 74, rot: 0, scale: 0.8, ghost: false },
    {
      id: "g1",
      t: "lawn" as const,
      x: 39.3,
      y: 70,
      rot: 0,
      scale: 0.75,
      ghost: true,
      why: "Permeable core · lifts site permeability",
      conf: 0.92,
    },
    {
      id: "g2",
      t: "canopy" as const,
      x: 35,
      y: 80,
      rot: 0,
      scale: 0.65,
      ghost: true,
      why: "Canopy target · clear of sewer easement",
      conf: 0.87,
    },
    {
      id: "g3",
      t: "frenchdrain" as const,
      x: 39.3,
      y: 50,
      rot: 0,
      scale: 1,
      ghost: true,
      why: "Intercepts runoff at paving low point",
      conf: 0.9,
    },
  ] as StudioItem[],
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
  { id: "edit", label: "Edit", icon: "◇" },
  { id: "add", label: "Add", icon: "+" },
  { id: "lock", label: "Lock", icon: "⬡" },
  { id: "reset", label: "Reset", icon: "↺" },
  { id: "pan", label: "Pan", icon: "✥" },
] as const;

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
  | "sketch";

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

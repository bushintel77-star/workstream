/**
 * Auto-trench — landscape-architect construction routing from authored zones
 * and drains. Proposes dig paths for irrigation main/laterals, lighting
 * conduit, and drainage — avoiding easement rings and TPZ discs when possible.
 *
 * Indicative Workflow 1 geometry — not DBYD / authority asset plans.
 */

import {
  clampBoardPct,
  type ConstructionTrench,
  type ConstructionTrenchKind,
  type IrrigationZone,
} from "@workstream/contracts";
import {
  polylineLengthFromCanvasPercent,
  type CanvasGroundScale,
} from "./canvas-geometry";
import type { LngLat } from "./geometry";
import { pointInRing } from "./site-overlays";

export type AutoTrenchPct = { x: number; y: number };

export type AutoTrenchItem = {
  id: string;
  t: string;
  x: number;
  y: number;
  ghost?: boolean;
  dbhM?: number;
};

export type AutoTrenchInput = {
  zones: IrrigationZone[];
  items: AutoTrenchItem[];
  /** Closed easement rings in board %. */
  easements: AutoTrenchPct[][];
  /** Existing survey/Vicmap service corridors (avoid crossing when possible). */
  services: AutoTrenchPct[][];
  boundary: AutoTrenchPct[];
  building: AutoTrenchPct[];
  /** Board width metres (100% → m). */
  scaleM: number;
  /** When true, proposals are marked ghost for Accept/Reject. */
  asGhosts?: boolean;
};

export type AutoTrenchProposal = ConstructionTrench;

const DEPTH: Record<ConstructionTrenchKind, number> = {
  irrig_main: 400,
  irrig_lateral: 250,
  lighting_conduit: 300,
  drainage: 450,
};

function pctToLngLat(p: AutoTrenchPct): LngLat {
  // Local board space treated as a unit square for point-in-ring only.
  return [p.x, p.y];
}

function ringContains(ring: AutoTrenchPct[], p: AutoTrenchPct): boolean {
  if (ring.length < 3) return false;
  return pointInRing(p.x, p.y, ring.map(pctToLngLat));
}

function inAnyEasement(
  easements: AutoTrenchPct[][],
  p: AutoTrenchPct,
): boolean {
  return easements.some((r) => ringContains(r, p));
}

function tpzRadiusPct(dbhM: number, scaleM: number): number {
  const rM = Math.max(2, 12 * dbhM);
  return (rM / Math.max(1, scaleM)) * 100;
}

function inAnyTpz(
  trees: AutoTrenchItem[],
  p: AutoTrenchPct,
  scaleM: number,
): boolean {
  for (const t of trees) {
    if (t.t !== "exist") continue;
    const dbh = t.dbhM ?? 0.45;
    const r = tpzRadiusPct(dbh, scaleM);
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** Nudge a point out of easement/TPZ toward lot centre when constrained. */
function clearPoint(
  p: AutoTrenchPct,
  easements: AutoTrenchPct[][],
  trees: AutoTrenchItem[],
  scaleM: number,
  toward: AutoTrenchPct,
): AutoTrenchPct {
  if (!inAnyEasement(easements, p) && !inAnyTpz(trees, p, scaleM)) return p;
  let best = p;
  // Walk toward lot centre in steps; then try cardinal offsets if still blocked.
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const cand = {
      x: p.x + (toward.x - p.x) * t,
      y: p.y + (toward.y - p.y) * t,
    };
    if (!inAnyEasement(easements, cand) && !inAnyTpz(trees, cand, scaleM)) {
      return { x: clampBoardPct(cand.x), y: clampBoardPct(cand.y) };
    }
    best = cand;
  }
  const offsets = [
    { x: 0, y: -6 },
    { x: 0, y: 6 },
    { x: -6, y: 0 },
    { x: 6, y: 0 },
    { x: -6, y: -6 },
    { x: 6, y: -6 },
  ];
  for (const o of offsets) {
    const cand = { x: p.x + o.x, y: p.y + o.y };
    if (!inAnyEasement(easements, cand) && !inAnyTpz(trees, cand, scaleM)) {
      return { x: clampBoardPct(cand.x), y: clampBoardPct(cand.y) };
    }
  }
  return { x: clampBoardPct(best.x), y: clampBoardPct(best.y) };
}

function clearPolyline(
  pts: AutoTrenchPct[],
  easements: AutoTrenchPct[][],
  trees: AutoTrenchItem[],
  scaleM: number,
  toward: AutoTrenchPct,
): AutoTrenchPct[] {
  return pts.map((p) => clearPoint(p, easements, trees, scaleM, toward));
}

function zonePts(z: IrrigationZone): AutoTrenchPct[] {
  return z.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
}

function centroid(pts: AutoTrenchPct[]): AutoTrenchPct {
  if (pts.length === 0) return { x: 50, y: 50 };
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y };
}

/**
 * Valve / manifold cue — prefer outdoor edge nearest the dwelling, else
 * centroid of drip zone starts (landscape practice: main from house side).
 */
function manifoldPoint(
  dripStarts: AutoTrenchPct[],
  building: AutoTrenchPct[],
  boundary: AutoTrenchPct[],
): AutoTrenchPct {
  if (building.length >= 3) {
    const b = centroid(building);
    // Step slightly outdoors from building centroid toward lot centre.
    const lot = boundary.length >= 3 ? centroid(boundary) : { x: 50, y: 50 };
    return {
      x: b.x + (lot.x - b.x) * 0.15,
      y: b.y + (lot.y - b.y) * 0.15,
    };
  }
  if (dripStarts.length > 0) return centroid(dripStarts);
  return boundary.length >= 3 ? centroid(boundary) : { x: 50, y: 50 };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for exotic runtimes — still UUID-shaped for contracts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function proposal(
  kind: ConstructionTrenchKind,
  name: string,
  points: AutoTrenchPct[],
  why: string,
  asGhost: boolean,
): AutoTrenchProposal | null {
  if (points.length < 2) return null;
  return {
    id: makeId(),
    name,
    kind,
    points: points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
    depth_mm: DEPTH[kind],
    source: "auto",
    ghost: asGhost ? true : undefined,
    why,
  };
}

/**
 * Propose construction trenches from authored drip/lighting zones and french
 * drains. Avoids easement hatch and TPZ discs with a simple nudge.
 */
/** Closed survey / Vicmap corridors treated as no-dig rings. */
function closedAvoidRings(services: AutoTrenchPct[][]): AutoTrenchPct[][] {
  return services.filter((r) => {
    if (r.length < 3) return false;
    const a = r[0]!;
    const b = r[r.length - 1]!;
    const closed =
      Math.hypot(a.x - b.x, a.y - b.y) < 1.5 || r.length >= 4;
    return closed;
  });
}

export function proposeAutoTrenches(input: AutoTrenchInput): AutoTrenchProposal[] {
  const asGhost = input.asGhosts !== false;
  const trees = input.items.filter((i) => i.t === "exist" && !i.ghost);
  const toward =
    input.boundary.length >= 3
      ? centroid(input.boundary)
      : { x: 50, y: 50 };
  const avoid = [...input.easements, ...closedAvoidRings(input.services)];
  const out: AutoTrenchProposal[] = [];

  const drip = input.zones.filter((z) => (z.kind ?? "drip") === "drip");
  const lighting = input.zones.filter((z) => z.kind === "lighting");
  const drains = input.items.filter(
    (i) => i.t === "frenchdrain" && !i.ghost,
  );

  const dripStarts = drip
    .map((z) => zonePts(z)[0])
    .filter((p): p is AutoTrenchPct => Boolean(p));
  const manifold = clearPoint(
    manifoldPoint(dripStarts, input.building, input.boundary),
    avoid,
    trees,
    input.scaleM,
    toward,
  );

  drip.forEach((z, i) => {
    const raw = zonePts(z);
    const pts = clearPolyline(raw, avoid, trees, input.scaleM, toward);
    const lat = proposal(
      "irrig_lateral",
      `Irrig lateral · ${z.name || i + 1}`,
      pts,
      "Trench under authored drip run — 250 mm indicative",
      asGhost,
    );
    if (lat) out.push(lat);

    const start = pts[0];
    if (start) {
      const mainPts = clearPolyline(
        [manifold, start],
        avoid,
        trees,
        input.scaleM,
        toward,
      );
      const main = proposal(
        "irrig_main",
        `Irrig main · ${z.name || i + 1}`,
        mainPts,
        "Mainline from valve manifold (house side) to zone start — 400 mm indicative",
        asGhost,
      );
      if (main) out.push(main);
    }
  });

  lighting.forEach((z, i) => {
    const pts = clearPolyline(
      zonePts(z),
      avoid,
      trees,
      input.scaleM,
      toward,
    );
    const conduit = proposal(
      "lighting_conduit",
      `Lighting conduit · ${z.name || i + 1}`,
      pts,
      "Conduit trench along lighting run — 300 mm indicative; confirm RCD / electrician",
      asGhost,
    );
    if (conduit) out.push(conduit);
  });

  if (drains.length >= 1) {
    // Chain french-drain symbols toward the southern-most boundary edge mid.
    let outfall = toward;
    if (input.boundary.length >= 2) {
      const south = [...input.boundary].sort((a, b) => b.y - a.y)[0]!;
      outfall = south;
    }
    const ordered = [...drains].sort((a, b) => a.y - b.y);
    const path: AutoTrenchPct[] = ordered.map((d) => ({ x: d.x, y: d.y }));
    path.push(outfall);
    const pts = clearPolyline(path, avoid, trees, input.scaleM, toward);
    const drain = proposal(
      "drainage",
      "Drainage trench",
      pts,
      "Ag-pipe trench chaining french drains to outfall cue — 450 mm indicative",
      asGhost,
    );
    if (drain) out.push(drain);
  }

  return out;
}

export type TrenchLineItem = {
  sku: string;
  label: string;
  unit: string;
  qty: number;
  kind: ConstructionTrenchKind;
  /** Representative trench depth (mm) — the second cost dimension. */
  depth_mm: number;
  /** Excavation volume (m³) — length × width × depth. Indicative. */
  volume_m3: number;
  /** Total length in metres (before rounding to qty). */
  length_m: number;
};

const SKU: Record<ConstructionTrenchKind, { sku: string; label: string }> = {
  irrig_main: {
    sku: "TRENCH-IRRIG-MAIN",
    label: "Irrigation main trench (excavate + backfill)",
  },
  irrig_lateral: {
    sku: "TRENCH-IRRIG-LAT",
    label: "Irrigation lateral trench",
  },
  lighting_conduit: {
    sku: "TRENCH-LIGHT-CONDUIT",
    label: "Lighting conduit trench",
  },
  drainage: {
    sku: "TRENCH-DRAIN",
    label: "Drainage trench (ag-pipe corridor)",
  },
};

/** Indicative trench width per kind (mm) — industry typical for residential landscape. */
const TRENCH_WIDTH_MM: Record<ConstructionTrenchKind, number> = {
  irrig_main: 200,
  irrig_lateral: 150,
  lighting_conduit: 200,
  drainage: 300,
};

/** BOM lm lines from accepted (non-ghost) trenches. */
export function trenchLineItems(
  trenches: ConstructionTrench[],
  scale: CanvasGroundScale,
): TrenchLineItem[] {
  const live = trenches.filter((t) => !t.ghost);
  const byKind = new Map<
    ConstructionTrenchKind,
    { length: number; depthMm: number }
  >();
  for (const t of live) {
    const lm = polylineLengthFromCanvasPercent(
      t.points.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
      scale,
    );
    const prev = byKind.get(t.kind);
    const depthMm = t.depth_mm ?? 300;
    byKind.set(t.kind, {
      length: (prev?.length ?? 0) + lm,
      // Representative depth — the first trench of this kind encountered.
      depthMm: prev?.depthMm ?? depthMm,
    });
  }
  const items: TrenchLineItem[] = [];
  for (const [kind, { length: lm, depthMm }] of byKind) {
    if (lm <= 0) continue;
    const meta = SKU[kind];
    const widthM = TRENCH_WIDTH_MM[kind] / 1000;
    const depthM = depthMm / 1000;
    const volumeM3 = lm * widthM * depthM;
    items.push({
      sku: meta.sku,
      label: meta.label,
      unit: "lm",
      qty: Math.ceil(lm * 10) / 10,
      kind,
      depth_mm: depthMm,
      volume_m3: Math.round(volumeM3 * 100) / 100,
      length_m: Math.round(lm * 100) / 100,
    });
  }
  return items;
}

export function trenchKindLabel(kind: ConstructionTrenchKind): string {
  switch (kind) {
    case "irrig_main":
      return "Irrigation main";
    case "irrig_lateral":
      return "Irrigation lateral";
    case "lighting_conduit":
      return "Lighting conduit";
    case "drainage":
      return "Drainage";
    default:
      return kind;
  }
}

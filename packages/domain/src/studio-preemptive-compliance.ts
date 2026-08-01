/**
 * Preemptive "invisible council inspector" for the Design Studio handoff board.
 *
 * Runs as a pure background evaluation on every geometry commit — no Calculate
 * button. Tuned for Melbourne residential gardens + AS 4970 TPZ.
 * Multi-council profiles via `councilProfileFor(lgaCode)`.
 */

export type CouncilProfile = {
  id: string;
  label: string;
  permeableMinPct: number;
  canopyTargetPct: number;
  setbackM: number;
};

export const COUNCIL_PROFILES: Record<string, CouncilProfile> = {
  STON: {
    id: "STON",
    label: "Stonnington",
    permeableMinPct: 20,
    canopyTargetPct: 15,
    setbackM: 1.5,
  },
  PORT: {
    id: "PORT",
    label: "Port Phillip",
    permeableMinPct: 20,
    canopyTargetPct: 15,
    setbackM: 1.5,
  },
  BAYS: {
    id: "BAYS",
    label: "Bayside",
    permeableMinPct: 25,
    canopyTargetPct: 20,
    setbackM: 2.0,
  },
  BORO: {
    id: "BORO",
    label: "Boroondara",
    permeableMinPct: 20,
    canopyTargetPct: 15,
    setbackM: 1.5,
  },
  GLEN: {
    id: "GLEN",
    label: "Glen Eira",
    permeableMinPct: 20,
    canopyTargetPct: 15,
    setbackM: 1.5,
  },
  MELB: {
    id: "MELB",
    label: "Melbourne",
    permeableMinPct: 15,
    canopyTargetPct: 10,
    setbackM: 1.5,
  },
  YARR: {
    id: "YARR",
    label: "Yarra",
    permeableMinPct: 20,
    canopyTargetPct: 15,
    setbackM: 1.5,
  },
};

const DEFAULT_PROFILE = COUNCIL_PROFILES.STON!;

export function councilProfileFor(lgaCode: string | null | undefined): CouncilProfile {
  if (!lgaCode) return DEFAULT_PROFILE;
  const key = lgaCode.slice(0, 4).toUpperCase();
  return COUNCIL_PROFILES[key] ?? DEFAULT_PROFILE;
}

/** @deprecated Use councilProfileFor(lgaCode).permeableMinPct */
export const STONNINGTON_PERMEABLE_MIN_PCT = 20;
/** @deprecated Use councilProfileFor(lgaCode).canopyTargetPct */
export const STONNINGTON_CANOPY_TARGET_PCT = 15;
/** @deprecated Use councilProfileFor(lgaCode).setbackM */
export const COUNCIL_SETBACK_M = 1.5;
/** AS 4970 TPZ encroachment watch threshold (indicative). */
export const TPZ_ENCROACH_WARN_PCT = 10;

export type StudioComplianceItemType =
  | "canopy"
  | "feature"
  | "paving"
  | "deck"
  | "lawn"
  | "hedge"
  | "bed"
  | "frenchdrain"
  | "exist";

export type StudioComplianceItem = {
  id: string;
  t: StudioComplianceItemType;
  x: number;
  y: number;
  scale: number;
  ghost?: boolean;
  /** Optional DBH metres for existing trees; defaults by type. */
  dbhM?: number;
  canopyM?: number;
  wPx?: number;
  hPx?: number;
  areaKind?: "rect" | "ellipse" | "none";
};

type BoardPoint = { x: number; y: number };

export type ComplianceAlert = {
  id: string;
  severity: "critical" | "watch" | "info";
  code: "permeability" | "canopy" | "setback" | "tpz" | "outdoor";
  title: string;
  detail: string;
  /** Item ids implicated (for highlighting). */
  sourceIds: string[];
};

export type StudioComplianceReport = {
  outdoorM2: number;
  permeablePct: number;
  canopyPct: number;
  permeableOk: boolean;
  canopyOk: boolean;
  outdoorOk: boolean;
  pass: boolean;
  /** Drives canvas border: ok | watch | critical */
  canvasSignal: "ok" | "watch" | "critical";
  alerts: ComplianceAlert[];
  setbackM: number;
  permeableMinPct: number;
  canopyTargetPct: number;
};

export type BuildableEnvelope = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  insetPct: number;
};

const HARD = new Set<StudioComplianceItemType>(["paving", "deck"]);
const PERM = new Set<StudioComplianceItemType>(["lawn", "bed", "hedge"]);
const STRUCTURE_PLACE = new Set<StudioComplianceItemType>([
  "paving",
  "deck",
  "feature",
  "canopy",
  "hedge",
  "bed",
  "frenchdrain",
]);

function itemAreaM2(
  it: StudioComplianceItem,
  _scaleM: number,
): number {
  const wPx = it.wPx ?? 100;
  const hPx = it.hPx ?? 80;
  // Catalog px ≈ 40 px per metre at scale reference (handoff convention).
  const wm = (wPx * it.scale) / 40;
  const hm = (hPx * it.scale) / 40;
  if (it.areaKind === "ellipse") return (Math.PI / 4) * wm * hm;
  if (it.areaKind === "rect") return wm * hm;
  if (it.t === "lawn" || it.t === "bed") return wm * hm * 0.85;
  if (HARD.has(it.t)) return wm * hm;
  return 0;
}

function canopyCoverM2(it: StudioComplianceItem): number {
  const r = ((it.canopyM ?? 0) * it.scale) / 2;
  if (r <= 0) return 0;
  return Math.PI * r * r;
}

function tpzRadiusM(it: StudioComplianceItem): number {
  const dbh = it.dbhM ?? (it.t === "exist" ? 0.45 : 0);
  if (dbh <= 0) return 0;
  return Math.max(2, 12 * dbh);
}

function pctToM(dxPct: number, scaleM: number): number {
  return (dxPct / 100) * scaleM;
}

/** Axis-aligned buildable envelope from parcel bbox + council setback. */
export function buildableEnvelopeFromBoundary(
  boundary: BoardPoint[],
  setbackM = COUNCIL_SETBACK_M,
  scaleM = 110,
): BuildableEnvelope | null {
  if (boundary.length < 3) return null;
  const xs = boundary.map((p) => p.x);
  const ys = boundary.map((p) => p.y);
  const insetPct = (setbackM / scaleM) * 100;
  const minX = Math.min(...xs) + insetPct;
  const maxX = Math.max(...xs) - insetPct;
  const minY = Math.min(...ys) + insetPct;
  const maxY = Math.max(...ys) - insetPct;
  if (maxX <= minX || maxY <= minY) return null;
  return { minX, maxX, minY, maxY, insetPct };
}

/**
 * Snap a proposed placement into the buildable envelope.
 * Returns snapped=true when the point was inside the setback strip.
 */
export function snapPointToBuildableEnvelope(
  x: number,
  y: number,
  envelope: BuildableEnvelope | null,
): { x: number; y: number; snapped: boolean; codeHint: string | null } {
  if (!envelope) {
    return { x, y, snapped: false, codeHint: null };
  }
  const nx = Math.max(envelope.minX, Math.min(envelope.maxX, x));
  const ny = Math.max(envelope.minY, Math.min(envelope.maxY, y));
  const snapped = Math.abs(nx - x) > 0.05 || Math.abs(ny - y) > 0.05;
  return {
    x: nx,
    y: ny,
    snapped,
    codeHint: snapped
      ? `Snapped clear of ${COUNCIL_SETBACK_M.toFixed(1)} m council setback`
      : null,
  };
}

export function shouldEnforceSetback(type: StudioComplianceItemType): boolean {
  return STRUCTURE_PLACE.has(type);
}

/**
 * Continuous compliance evaluation — call after every mutate / place / move.
 */
export function evaluateStudioCompliance(args: {
  outdoorM2: number;
  boundary: BoardPoint[];
  items: StudioComplianceItem[];
  scaleM?: number;
  permeableMinPct?: number;
  canopyTargetPct?: number;
  setbackM?: number;
}): StudioComplianceReport {
  const scaleM = args.scaleM ?? 110;
  const permeableMin =
    args.permeableMinPct ?? STONNINGTON_PERMEABLE_MIN_PCT;
  const canopyTarget =
    args.canopyTargetPct ?? STONNINGTON_CANOPY_TARGET_PCT;
  const setbackM = args.setbackM ?? COUNCIL_SETBACK_M;
  const outdoor = Math.max(args.outdoorM2, 1);
  const live = args.items.filter((i) => !i.ghost);

  let permeableM2 = 0;
  let hardM2 = 0;
  let canopyM2 = 0;
  const hardIds: string[] = [];

  for (const it of live) {
    const area = itemAreaM2(it, scaleM);
    if (PERM.has(it.t) || it.t === "lawn" || it.t === "bed") {
      permeableM2 += area || outdoor * 0.06;
    }
    if (HARD.has(it.t)) {
      hardM2 += area || outdoor * 0.05;
      hardIds.push(it.id);
    }
    if (it.t === "canopy" || it.t === "feature" || it.t === "exist") {
      canopyM2 += canopyCoverM2(it) || (it.t === "exist" ? Math.PI * 9 : 0);
    }
  }

  // Stonnington-style: outdoor area minus hardscape coverage = permeable share.
  // Sparse seed sites (no hard/soft yet) keep an indicative pass baseline.
  const hasHardOrSoft = permeableM2 > 0 || hardM2 > 0;
  const hardCoveragePct = Math.min(100, (hardM2 / outdoor) * 100);
  const permeablePct = hasHardOrSoft
    ? Math.max(0, Math.min(100, 100 - hardCoveragePct))
    : 54;
  const canopyPct =
    canopyM2 > 0
      ? Math.max(0, Math.min(100, (canopyM2 / outdoor) * 100))
      : live.some((i) => i.t === "exist")
        ? 15
        : 0;

  const outdoorOk = outdoor >= 40;
  const permeableOk = permeablePct >= permeableMin;
  const alerts: ComplianceAlert[] = [];

  if (!outdoorOk) {
    alerts.push({
      id: "outdoor-area",
      severity: "watch",
      code: "outdoor",
      title: "Outdoor area below typical dwelling provision",
      detail: `${outdoor.toFixed(1)} m² outdoor — review private open space targets.`,
      sourceIds: [],
    });
  }

  if (!permeableOk) {
    alerts.push({
      id: "permeability",
      severity: "critical",
      code: "permeability",
      title: `Permeability below ${permeableMin}% (Stonnington-style)`,
      detail: `Site at ${Math.round(permeablePct)}% permeable. Hardscape items are driving the shortfall — reduce paving/deck or add lawn/beds.`,
      sourceIds: hardIds,
    });
  }

  if (canopyM2 > 0 && canopyPct < canopyTarget) {
    alerts.push({
      id: "canopy",
      severity: "watch",
      code: "canopy",
      title: `Canopy cover below ${canopyTarget}% at maturity`,
      detail: `Projected canopy ${Math.round(canopyPct)}% of outdoor area. Add structure planting or retain existing canopy.`,
      sourceIds: live
        .filter((i) => i.t === "canopy" || i.t === "feature" || i.t === "exist")
        .map((i) => i.id),
    });
  }

  const envelope = buildableEnvelopeFromBoundary(
    args.boundary,
    setbackM,
    scaleM,
  );
  if (envelope) {
    for (const it of live) {
      if (!shouldEnforceSetback(it.t)) continue;
      const inside =
        it.x >= envelope.minX &&
        it.x <= envelope.maxX &&
        it.y >= envelope.minY &&
        it.y <= envelope.maxY;
      if (!inside) {
        alerts.push({
          id: `setback-${it.id}`,
          severity: "critical",
          code: "setback",
          title: `${setbackM.toFixed(1)} m setback encroachment`,
          detail: `Placement sits inside the council setback strip. Geometry will snap to the buildable envelope on the next move.`,
          sourceIds: [it.id],
        });
      }
    }
  }

  // AS 4970 TPZ vs hardscape intersection (indicative % of TPZ disc).
  const trees = live.filter((i) => i.t === "exist" || i.t === "canopy");
  for (const tree of trees) {
    const dbh =
      tree.dbhM ??
      (tree.t === "exist" ? 0.45 : tree.t === "canopy" ? 0.35 : 0);
    const tpzR = tpzRadiusM({ ...tree, dbhM: dbh });
    if (tpzR <= 0) continue;
    const tpzArea = Math.PI * tpzR * tpzR;
    for (const hard of live.filter((i) => HARD.has(i.t))) {
      const distM = pctToM(
        Math.hypot(hard.x - tree.x, hard.y - tree.y),
        scaleM,
      );
      const hardArea = Math.max(itemAreaM2(hard, scaleM), 2);
      const hardR = Math.sqrt(hardArea / Math.PI);
      if (distM > tpzR + hardR) continue;
      let encroachPct = approximateDiscOverlapPct(tpzR, hardR, distM);
      // Centre-inside TPZ: floor at a meaningful watch level when discs touch.
      if (distM < tpzR && encroachPct < TPZ_ENCROACH_WARN_PCT) {
        encroachPct = Math.max(
          encroachPct,
          Math.min(40, ((tpzR - distM) / tpzR) * 35),
        );
      }
      if (encroachPct < TPZ_ENCROACH_WARN_PCT) continue;
      const severity =
        encroachPct >= 20 ? ("critical" as const) : ("watch" as const);
      alerts.push({
        id: `tpz-${tree.id}-${hard.id}`,
        severity,
        code: "tpz",
        title: `TPZ encroachment ${Math.round(encroachPct)}% (AS 4970)`,
        detail:
          encroachPct >= 15
            ? `Excavation / hardscape compromises ~${Math.round(encroachPct)}% of the existing tree root zone — structural arborist report required.`
            : `Hardscape intersects the TPZ (~${Math.round(encroachPct)}% of ${tpzArea.toFixed(0)} m² ring). Shift clear or accept TRP mitigation.`,
        sourceIds: [tree.id, hard.id],
      });
    }
  }

  const critical = alerts.some((a) => a.severity === "critical");
  const watch = alerts.some((a) => a.severity === "watch");
  const pass = !critical && permeableOk && outdoorOk;

  return {
    outdoorM2: outdoor,
    permeablePct,
    canopyPct,
    permeableOk,
    canopyOk: canopyPct >= canopyTarget || canopyM2 === 0,
    outdoorOk,
    pass,
    canvasSignal: critical ? "critical" : watch || !pass ? "watch" : "ok",
    alerts: alerts.slice(0, 8),
    setbackM,
    permeableMinPct: permeableMin,
    canopyTargetPct: canopyTarget,
  };
}

/** Two-circle intersection area as % of the TPZ disc. */
export function approximateDiscOverlapPct(
  tpzR: number,
  hardR: number,
  dist: number,
): number {
  if (tpzR <= 0) return 0;
  if (dist >= tpzR + hardR) return 0;
  if (dist <= Math.abs(tpzR - hardR)) {
    const inner = Math.min(tpzR, hardR);
    return Math.min(100, ((Math.PI * inner * inner) / (Math.PI * tpzR * tpzR)) * 100);
  }
  const r = tpzR;
  const R = hardR;
  const d = dist;
  const r2 = r * r;
  const R2 = R * R;
  const a =
    r2 * Math.acos((d * d + r2 - R2) / (2 * d * r)) +
    R2 * Math.acos((d * d + R2 - r2) / (2 * d * R)) -
    0.5 *
    Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
  if (!Number.isFinite(a) || a <= 0) return 0;
  return Math.min(100, (a / (Math.PI * r2)) * 100);
}

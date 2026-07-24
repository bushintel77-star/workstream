/**
 * Spatial Correction + Stage 1 Cadastral Foundation Cleanse —
 * Workflow 1 deterministic geometry ops (no PostGIS).
 */

import {
  BY_TYPE,
  type SketchStroke,
  type StudioItem,
  type StudioItemType,
} from "../studioCatalog";
import type { PctPoint } from "../geometry";

const SCALE_M = 110;

const VEG: StudioItemType[] = ["exist", "canopy", "feature"];

/** All botanical / softscape types purged in Stage 1 foundation cleanse. */
const FOUNDATION_VEG_PURGE: StudioItemType[] = [
  "exist",
  "canopy",
  "feature",
  "hedge",
  "bed",
  "lawn",
];

/** Vicmap title CAD overlay — deep charcoal primary vector. */
import { SEMANTIC_LIGHT } from "../../../../styles/colorTokens";

/** Default CAD vector ink — light parchment plate. */
export const COLOR_VECTOR_PRIMARY = SEMANTIC_LIGHT.textPrimary;
export const FOUNDATION_BOUNDARY_STROKE_PX = 1.5;

export type SpatialCorrectionReport = {
  aerialSuppressed: boolean;
  boundarySnapped: boolean;
  vegetationRemoved: number;
  scalesClamped: number;
  notes: string[];
};

export type Stage1FoundationReport = {
  aerialPurged: boolean;
  vegetationPurged: number;
  sketchesCleared: number;
  boundaryLocked: boolean;
  notes: string[];
};

function canopyRadiusPct(it: StudioItem): number {
  const d = BY_TYPE[it.t];
  const canopyM = d.canopyM ?? (d.heightM ?? 2) * 0.55;
  const rM = (canopyM * it.scale) / 2;
  return (rM / SCALE_M) * 100;
}

function vegPriority(it: StudioItem): number {
  let p = 0;
  if (it.t === "exist") p += 40;
  if (!it.ghost) p += 20;
  if (it.conf != null) p += it.conf * 10;
  if (it.why) p += 5;
  p += canopyRadiusPct(it);
  return p;
}

/**
 * Vegetation vector sieve — drop overlapping canopy/exist/feature nodes.
 * Existing: 1.5× radius clearance. Proposed: 1.1× combined radii.
 */
export function sieveVegetationItems(items: StudioItem[]): {
  items: StudioItem[];
  removed: number;
} {
  const veg = items.filter((i) => VEG.includes(i.t));
  const other = items.filter((i) => !VEG.includes(i.t));
  const ranked = [...veg].sort((a, b) => vegPriority(b) - vegPriority(a));
  const kept: StudioItem[] = [];

  for (const cand of ranked) {
    const rCand = canopyRadiusPct(cand);
    const clash = kept.some((k) => {
      const rK = canopyRadiusPct(k);
      const dist = Math.hypot(cand.x - k.x, cand.y - k.y);
      const need =
        cand.t === "exist" || k.t === "exist"
          ? 1.5 * Math.max(rCand, rK)
          : 1.1 * (rCand + rK);
      return dist < need;
    });
    if (!clash) kept.push(cand);
  }

  return {
    items: [...other, ...kept],
    removed: veg.length - kept.length,
  };
}

/**
 * Clamp vegetation scale so mature height ≤ catalog heightM (true vertical).
 */
export function clampVegetationElevationScale(items: StudioItem[]): {
  items: StudioItem[];
  clamped: number;
} {
  let clamped = 0;
  const next = items.map((it) => {
    if (!VEG.includes(it.t) && it.t !== "hedge") return it;
    const h = BY_TYPE[it.t].heightM;
    if (h == null) return it;
    if (it.scale <= 1.001) return it;
    clamped += 1;
    return { ...it, scale: 1 };
  });
  return { items: next, clamped };
}

/**
 * Stage 1 — strip all vegetation / softscape (manual place remains available).
 * Stronger than sieveVegetationItems (overlap-only).
 */
export function purgeVegetationItems(items: StudioItem[]): {
  items: StudioItem[];
  removed: number;
} {
  const next = items.filter((i) => !FOUNDATION_VEG_PURGE.includes(i.t));
  return { items: next, removed: items.length - next.length };
}

/** Drop AI ghosts so Stage 1 has no generative residue. */
export function purgeGhostItems(items: StudioItem[]): {
  items: StudioItem[];
  removed: number;
} {
  const next = items.filter((i) => !i.ghost);
  return { items: next, removed: items.length - next.length };
}

/**
 * Clear freehand strokes that approximate a closed lot outline
 * (or clear all strokes when foundation cleanse wants a blank vector plane).
 */
export function clearBoundaryLikeSketches(
  strokes: SketchStroke[],
  boundary: PctPoint[],
  opts?: { clearAll?: boolean },
): { strokes: SketchStroke[]; cleared: number } {
  if (opts?.clearAll || boundary.length < 3) {
    return { strokes: [], cleared: strokes.length };
  }
  const kept = strokes.filter((s) => {
    if (s.points.length < 4) return true;
    // Heuristic: stroke whose bbox is within ~12% of the title bbox → title trace
    const sx = s.points.map((p) => p.x);
    const sy = s.points.map((p) => p.y);
    const bx = boundary.map((p) => p.x);
    const by = boundary.map((p) => p.y);
    const sMinX = Math.min(...sx);
    const sMaxX = Math.max(...sx);
    const sMinY = Math.min(...sy);
    const sMaxY = Math.max(...sy);
    const bMinX = Math.min(...bx);
    const bMaxX = Math.max(...bx);
    const bMinY = Math.min(...by);
    const bMaxY = Math.max(...by);
    const near =
      Math.abs(sMinX - bMinX) < 12 &&
      Math.abs(sMaxX - bMaxX) < 12 &&
      Math.abs(sMinY - bMinY) < 12 &&
      Math.abs(sMaxY - bMaxY) < 12;
    return !near;
  });
  return { strokes: kept, cleared: strokes.length - kept.length };
}

/** NLP intent — title-boundary / cadastral foundation (progressive, unlabeled). */
export function isStage1FoundationQuery(query: string): boolean {
  const q = query.toLowerCase();
  return /stage\s*1|title\s+boundary|cadastral\s+foundation|foundation\s+cleanse|purge\s+(aerial|vegetation|ai)|vicmap\s+(title|parcel)|authoritative\s+(title|cadastral)|legal\s+land\s+records|to[- ]scale\s+2d\s+cad\s+title|vector\s+alignment|layer\s+purge/.test(
    q,
  );
}

/** NLP intent detector for the four-tier spatial correction pipeline. */
export function isSpatialCorrectionQuery(query: string): boolean {
  if (isStage1FoundationQuery(query)) return false;
  const q = query.toLowerCase();
  return /spatial\s*correct|cadastral|snap\s*to\s*title|vicmap|land\s*vic|clean\s*(the\s*)?(canvas|site|vegetation|trees)|sieve\s*(trees|veg)|drop\s*aerial|suppress\s*aerial|parchment\s*only|verify\s*elevation|oversized|title\s*boundary|parcel\s*snap/.test(
    q,
  );
}

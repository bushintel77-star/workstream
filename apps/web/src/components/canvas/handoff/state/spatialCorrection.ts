/**
 * Spatial Correction pipeline — Workflow 1 deterministic geometry ops
 * driven by the NLP Spatial Reasoner (no PostGIS).
 */

import { BY_TYPE, type StudioItem, type StudioItemType } from "../studioCatalog";

const SCALE_M = 110;

const VEG: StudioItemType[] = ["exist", "canopy", "feature"];

export type SpatialCorrectionReport = {
  aerialSuppressed: boolean;
  boundarySnapped: boolean;
  vegetationRemoved: number;
  scalesClamped: number;
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

/** NLP intent detector for the four-tier spatial correction pipeline. */
export function isSpatialCorrectionQuery(query: string): boolean {
  const q = query.toLowerCase();
  return /spatial\s*correct|cadastral|snap\s*to\s*title|vicmap|land\s*vic|clean\s*(the\s*)?(canvas|site|vegetation|trees)|sieve\s*(trees|veg)|drop\s*aerial|suppress\s*aerial|parchment\s*only|verify\s*elevation|oversized|title\s*boundary|parcel\s*snap/.test(
    q,
  );
}

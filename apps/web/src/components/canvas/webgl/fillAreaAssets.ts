/**
 * Gold Standard 2026 — mass planting geometry (area fill + row / hedge run).
 *
 * Pure: board-% input + a spacing in metres → board-% points.
 * Capped so a full-lot drag cannot mint hundreds of placements.
 *
 * Board-% space is ANISOTROPIC: pctToWorld stretches the Y axis by
 * boardAspect, so one percent of Y is not one percent of X in metres.
 * Every spacing figure here is therefore computed in true metres via
 * `metresPerPct` — interpolating in percent and assuming even metre
 * spacing would space a diagonal hedge wrongly on any non-square lot.
 */

import { getCatalogSymbol } from "@workstream/domain";
import { normalizeBox, type MarqueeBox } from "./marqueeSelect";
import type { PctPoint } from "./coordTransform";

export const MAX_AREA_PLANTS = 80;

/** Spacing used when the catalog has no spread for a coarse id. */
export const FALLBACK_SPACING_M = 1.5;

/**
 * Mass-plant spacing for an armed symbol — the catalog's mature spread, so a
 * pleached hornbeam rows at 4 m and a mondo edge at 0.3 m. Coarse ids with no
 * catalog record fall back to a neutral figure; nothing is invented per
 * species (the "never invented" law).
 */
export function massPlantSpacingM(symbolId: string): number {
  const catalog = getCatalogSymbol(symbolId);
  return catalog?.default_width_m ?? catalog?.mature_height_m ?? FALLBACK_SPACING_M;
}

/** Mature canopy radius (m) for a symbol, or null when uncatalogued. */
export function matureCanopyRadiusM(symbolId: string): number | null {
  const spread = getCatalogSymbol(symbolId)?.default_width_m;
  return spread != null && spread > 0 ? spread / 2 : null;
}

/** Metres carried by one board-% step on each axis (pctToWorld's scale). */
export function metresPerPct(
  scaleM: number,
  boardAspect: number,
): { x: number; y: number } {
  return { x: scaleM / 100, y: (scaleM * boardAspect) / 100 };
}

/** True metre length of a board-% segment (aspect-correct). */
export function segmentLengthM(
  a: PctPoint,
  b: PctPoint,
  scaleM: number,
  boardAspect: number,
): number {
  const m = metresPerPct(scaleM, boardAspect);
  return Math.hypot((b.x - a.x) * m.x, (b.y - a.y) * m.y);
}

export function gridInBox(
  a: PctPoint,
  b: PctPoint,
  spacingM: number,
  scaleM: number,
  boardAspect: number,
  cap = MAX_AREA_PLANTS,
): PctPoint[] {
  const box = normalizeBox(a, b);
  const spacing = Number.isFinite(spacingM) && spacingM > 0 ? spacingM : 1.2;
  const lotW = Math.max(scaleM, 1);
  const lotH = Math.max(scaleM * boardAspect, 1);
  const stepX = (spacing / lotW) * 100;
  const stepY = (spacing / lotH) * 100;
  const insetX = Math.min(stepX / 2, (box.x1 - box.x0) / 2);
  const insetY = Math.min(stepY / 2, (box.y1 - box.y0) / 2);
  const out: PctPoint[] = [];
  for (let y = box.y0 + insetY; y <= box.y1 - insetY + 1e-6; y += stepY) {
    for (let x = box.x0 + insetX; x <= box.x1 - insetX + 1e-6; x += stepX) {
      out.push({ x, y });
      if (out.length >= cap) return out;
    }
  }
  if (out.length === 0) {
    return [{ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }];
  }
  return out;
}

/**
 * Evenly spaced points along a board-% segment — the hedge / border / edge
 * case. Both endpoints are included, so a run drawn between two corners
 * plants a stem on each corner.
 *
 * The gap count comes from the TRUE metre length; the points themselves are
 * a uniform lerp in percent, which is exact because pctToWorld is affine
 * (a uniform parameter step is a uniform metre step along the run). The
 * realised centre-to-centre spacing is length / gaps — at or under the
 * requested spacing, never over, so a hedge never plants sparser than
 * specified.
 */
export function rowAlongLine(
  a: PctPoint,
  b: PctPoint,
  spacingM: number,
  scaleM: number,
  boardAspect: number,
  cap = MAX_AREA_PLANTS,
): PctPoint[] {
  const spacing = Number.isFinite(spacingM) && spacingM > 0 ? spacingM : 1.2;
  const lengthM = segmentLengthM(a, b, scaleM, boardAspect);
  if (!(lengthM > 1e-6)) return [{ x: a.x, y: a.y }];
  const maxGaps = Math.max(1, Math.floor(cap) - 1);
  const gaps = Math.min(maxGaps, Math.max(1, Math.ceil(lengthM / spacing)));
  const out: PctPoint[] = [];
  for (let i = 0; i <= gaps; i++) {
    const t = i / gaps;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Realised centre-to-centre spacing (m) for a run of `count` stems. */
export function rowSpacingM(
  a: PctPoint,
  b: PctPoint,
  count: number,
  scaleM: number,
  boardAspect: number,
): number {
  if (count < 2) return 0;
  return segmentLengthM(a, b, scaleM, boardAspect) / (count - 1);
}

/**
 * Run bearing as a scene Y-rotation (degrees), so an oriented symbol (hedge
 * body, paver, edging) lies ALONG the run instead of across it. Computed in
 * metre space: a Y-rotation of θ sends local +X to (cos θ, −sin θ) in world
 * (x, z), so θ = atan2(−dz, dx). Radially symmetric symbols (trees) should
 * not use this — a rotated canopy is noise.
 */
export function rowRotationDeg(
  a: PctPoint,
  b: PctPoint,
  scaleM: number,
  boardAspect: number,
): number {
  const m = metresPerPct(scaleM, boardAspect);
  const dx = (b.x - a.x) * m.x;
  const dz = (b.y - a.y) * m.y;
  if (Math.hypot(dx, dz) < 1e-9) return 0;
  const deg = (Math.atan2(-dz, dx) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function boxHint(box: MarqueeBox, count: number): string {
  return `Area plant · ${count} stem${count === 1 ? "" : "s"}`;
}

export function rowHint(count: number, spacingM: number): string {
  const stems = `${count} stem${count === 1 ? "" : "s"}`;
  if (!(spacingM > 0)) return `Row · ${stems}`;
  return `Row · ${stems} · ${spacingM.toFixed(2)} m centres`;
}

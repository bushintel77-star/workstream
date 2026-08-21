/**
 * Gold Standard 2026 — area-fill planting (groundcover / mass plant).
 *
 * Pure: a board-% box + spacing in metres → a grid of board-% points.
 * Capped so a full-lot drag cannot mint hundreds of placements.
 */

import { normalizeBox, type MarqueeBox } from "./marqueeSelect";
import type { PctPoint } from "./coordTransform";

export const MAX_AREA_PLANTS = 80;

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

export function boxHint(box: MarqueeBox, count: number): string {
  return `Area plant · ${count} stem${count === 1 ? "" : "s"}`;
}

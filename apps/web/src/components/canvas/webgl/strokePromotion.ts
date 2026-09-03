/**
 * Phase M.9 — Stroke → object promotion.
 *
 * Spec §7.3 / 5c: "When a stroke closes a loop on a plane, show a quiet chip
 * beside the nib with what the geometry already knows:
 * `Planting bed? · 42.6 m² · 26.1 m perim · closed on GRD`,
 * `⏎ PROMOTE` / `ESC`. Non-modal — keep drawing and it stays ink.
 * On promotion: named object, editable vertices, material applied, counted
 * in the schedule, `⌘Z` reverts to ink."
 *
 * This module owns the pure geometry: loop detection, area/perimeter
 * computation, and the promotion candidate data model. The chip UI and
 * the store wiring live in the React layer.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.9.
 * Reference: design_handoff §7.3, BUILD_CHECKLIST 8.9.
 */

import type { PctPoint } from "./coordTransform";

/** Active plane label for the promotion chip. */
export type PromotionPlane = "GRD" | "MAS" | "PLT" | "SUB" | "SEC";

/** The chip display duration before it auto-dismisses (spec: ~110ms visible
 * before the operator can act, but it stays until acted on — non-modal). */
export const CHIP_DISPLAY_MS = 110;

/** Minimum loop closure distance in board % to qualify as "closed". */
export const CLOSURE_THRESHOLD_PCT = 1.5;

/** Minimum area in m² to qualify for promotion (filters micro-strokes). */
export const MIN_AREA_M2 = 0.5;

/**
 * A stroke point in board-% space with optional pressure.
 */
export interface StrokePoint extends PctPoint {
  pressure?: number;
}

/**
 * Detect whether a stroke closes a loop (end point near start point).
 */
export function strokeIsClosed(
  points: StrokePoint[],
  thresholdPct: number = CLOSURE_THRESHOLD_PCT,
): boolean {
  if (points.length < 3) return false;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const dist = Math.hypot(last.x - first.x, last.y - first.y);
  return dist < thresholdPct;
}

/**
 * Compute the area of a closed polygon in board-% space using the
 * shoelace formula, then convert to m² using the board scale.
 */
export function polygonAreaM2(
  points: PctPoint[],
  scaleM: number,
  boardAspect: number,
): number {
  if (points.length < 3) return 0;
  const lotWidthM = scaleM;
  const lotHeightM = scaleM * boardAspect;
  // Shoelace in % space
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i]!.x * points[j]!.y - points[j]!.x * points[i]!.y;
  }
  const areaPct = Math.abs(sum) / 2;
  // Convert %² to m²: (x%/100 * lotWidthM) * (y%/100 * lotHeightM)
  return (areaPct / 10000) * lotWidthM * lotHeightM;
}

/**
 * Compute the perimeter of a closed polygon in board-% space,
 * converted to metres.
 */
export function polygonPerimeterM(
  points: PctPoint[],
  scaleM: number,
  boardAspect: number,
): number {
  if (points.length < 2) return 0;
  const lotWidthM = scaleM;
  const lotHeightM = scaleM * boardAspect;
  let perimM = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dxPct = points[j]!.x - points[i]!.x;
    const dyPct = points[j]!.y - points[i]!.y;
    const dxM = (dxPct / 100) * lotWidthM;
    const dyM = (dyPct / 100) * lotHeightM;
    perimM += Math.hypot(dxM, dyM);
  }
  return perimM;
}

/**
 * The promotion candidate shown in the quiet chip.
 */
export interface PromotionCandidate {
  /** The stroke points that form the closed loop. */
  points: PctPoint[];
  /** Area in m². */
  areaM2: number;
  /** Perimeter in m. */
  perimeterM: number;
  /** The plane the stroke was drawn on. */
  plane: PromotionPlane;
  /** Suggested object name (e.g. "Planting bed"). */
  suggestedName: string;
  /** Suggested material id, if any. */
  suggestedMaterialId?: string;
}

/**
 * Build a promotion candidate from a closed stroke, or return null if the
 * stroke is not closed or the area is too small.
 */
export function buildPromotionCandidate(
  stroke: StrokePoint[],
  scaleM: number,
  boardAspect: number,
  plane: PromotionPlane,
  opts?: { suggestedName?: string; suggestedMaterialId?: string },
): PromotionCandidate | null {
  if (!strokeIsClosed(stroke)) return null;
  const areaM2 = polygonAreaM2(stroke, scaleM, boardAspect);
  if (areaM2 < MIN_AREA_M2) return null;
  const perimeterM = polygonPerimeterM(stroke, scaleM, boardAspect);
  return {
    points: stroke.map((p) => ({ x: p.x, y: p.y })),
    areaM2,
    perimeterM,
    plane,
    suggestedName: opts?.suggestedName ?? defaultSuggestedName(plane),
    suggestedMaterialId: opts?.suggestedMaterialId,
  };
}

/** Default suggested object name based on the plane. */
function defaultSuggestedName(plane: PromotionPlane): string {
  switch (plane) {
    case "GRD":
      return "Planting bed";
    case "MAS":
      return "Massing";
    case "PLT":
      return "Planting bed";
    case "SUB":
      return "Subsurface zone";
    case "SEC":
      return "Section region";
  }
}

/**
 * Format the chip text: `Planting bed? · 42.6 m² · 26.1 m perim · closed on GRD`
 */
export function formatPromotionChip(candidate: PromotionCandidate): string {
  const area = candidate.areaM2.toFixed(1);
  const perim = candidate.perimeterM.toFixed(1);
  return `${candidate.suggestedName}? \u00b7 ${area} m\u00b2 \u00b7 ${perim} m perim \u00b7 closed on ${candidate.plane}`;
}

/**
 * A promoted object — the result of accepting the promotion chip.
 */
export interface PromotedObject {
  id: string;
  name: string;
  /** The polygon vertices (editable). */
  vertices: PctPoint[];
  /** Material id applied on promotion. */
  materialId?: string;
  /** The plane the object lives on. */
  plane: PromotionPlane;
  /** Provenance: the original stroke id, for ⌘Z revert. */
  sourceStrokeId: string;
  /** Area in m² at promotion time (recomputed on edit). */
  areaM2: number;
  /** Perimeter in m at promotion time. */
  perimeterM: number;
}

/**
 * Promote a stroke to an object. The original stroke is kept (source ink is
 * provenance) — ⌘Z reverts by removing the object and restoring the stroke
 * as the primary geometry.
 */
export function promoteStrokeToObject(
  candidate: PromotionCandidate,
  sourceStrokeId: string,
  materialId?: string,
): PromotedObject {
  return {
    id: crypto.randomUUID(),
    name: candidate.suggestedName,
    vertices: candidate.points,
    materialId: materialId ?? candidate.suggestedMaterialId,
    plane: candidate.plane,
    sourceStrokeId,
    areaM2: candidate.areaM2,
    perimeterM: candidate.perimeterM,
  };
}

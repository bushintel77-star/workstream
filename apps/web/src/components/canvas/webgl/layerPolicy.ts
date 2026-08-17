/**
 * Gold Standard 2026 — Canvas Layer Policy.
 *
 * The mode-driven visibility law for canvas backgrounds and data layers.
 * Pure function → unit-testable → consumed by WebGLStudioPreview to derive
 * scene props, so mode switching only changes props/opacity targets —
 * nothing remounts, the WebGL instance persists across all modes.
 *
 * Law (operator directive, 2026-08-18 — aerial retired):
 *   The canvas foundation is the authoritative Vicmap boundary + building
 *   envelope on Studio Paper — no photo underlay. The drawing IS the
 *   surface: ink, CAD geometry, and data layers sit directly on paper.
 *   SKETCH  — clean paper trace surface; ink is the only texture.
 *   CAD     — clean drafting: paper, accepted geometry, dims; subsurface
 *             remains explicitly opt-in.
 *   SURVEY  — owns the subsurface works: blueprint ground, BYDA utilities,
 *             easements, services rendered distinct (dashed/coloured).
 *   GARDEN/QUOTE/PRESENT — presentation contexts; subsurface available via
 *             the Underground tool but not forced.
 */

import type { CanvasMode } from "../../../lib/canvas-mode";

export type CanvasLayerPolicy = {
  /** Force the subsurface blueprint ground (vellum + utilities). */
  subsurface: boolean;
  /** BYDA utility runs + services corridors render. */
  utilities: boolean;
  /** Easement rings render. */
  easements: boolean;
  /** Drafting-grey ground for CAD (vs the olive site surface). */
  draftingSurface: boolean;
};

export function canvasLayerPolicy(mode: CanvasMode): CanvasLayerPolicy {
  switch (mode) {
    case "sketch":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        draftingSurface: false,
      };
    case "cad":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        draftingSurface: false,
      };
    case "survey":
      return {
        subsurface: true,
        utilities: true,
        easements: true,
        draftingSurface: false,
      };
    case "elevation":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        draftingSurface: false,
      };
    default:
      // garden | quote | present | share — presentation contexts.
      return {
        subsurface: false,
        utilities: true,
        easements: true,
        draftingSurface: false,
      };
  }
}

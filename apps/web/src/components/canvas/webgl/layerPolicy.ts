/**
 * Gold Standard 2026 — Canvas Layer Policy.
 *
 * The mode-driven visibility law for canvas backgrounds and data layers.
 * Pure function → unit-testable → consumed by WebGLStudioPreview to derive
 * scene props, so mode switching only changes props/opacity targets —
 * nothing remounts, the WebGL instance persists across all modes.
 *
 * Law (operator directive, 2026-08-15):
 *   SKETCH  — trace-friendly: aerial/photo base visible under the ink.
 *   CAD     — clean drafting surface: NO aerial, NO photo, NO subsurface —
 *             geometry and dimensions only, dark-grey Swiss-Brutalist ground.
 *   SURVEY  — owns the subsurface works: blueprint ground, BYDA utilities,
 *             easements, services rendered distinct (dashed/coloured).
 *   GARDEN/QUOTE/PRESENT — presentation contexts: aerial per view blend,
 *             subsurface available via the Underground tool but not forced.
 */

import type { CanvasMode } from "../../../lib/canvas-mode";

export type CanvasLayerPolicy = {
  /** Aerial/photo underlay opacity target (0 = hidden, 0.85 = full trace). */
  aerialOpacity: number;
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
        aerialOpacity: 0.85,
        subsurface: false,
        utilities: false,
        easements: true,
        draftingSurface: false,
      };
    case "cad":
      return {
        aerialOpacity: 0,
        subsurface: false,
        utilities: false,
        easements: false,
        draftingSurface: true,
      };
    case "survey":
      return {
        aerialOpacity: 0.5,
        subsurface: true,
        utilities: true,
        easements: true,
        draftingSurface: false,
      };
    case "elevation":
      return {
        aerialOpacity: 0.3,
        subsurface: false,
        utilities: false,
        easements: true,
        draftingSurface: false,
      };
    default:
      // garden | quote | present | share — presentation contexts.
      return {
        aerialOpacity: 0.85,
        subsurface: false,
        utilities: true,
        easements: true,
        draftingSurface: false,
      };
  }
}

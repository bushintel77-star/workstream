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
 *   SURVEY  — owns the subsurface works: BYDA utilities, easements, services
 *             rendered distinct (dashed/coloured). The blueprint ground is
 *             reachable from the Underground toggle but NOT forced on entry —
 *             Step 0 establishes the twin on paper (2026-08-22).
 *   GARDEN/QUOTE/PRESENT — presentation contexts; subsurface available via
 *             the Underground tool but not forced.
 *
 * SCALE-BAND VISIBILITY (2026-08 — the macro-zoom cleanup):
 *   Data layers declare a visible-scale window. "Scale" is the normalized
 *   view ratio `1 / zoom` (1 = fit view of the whole site, >1 = zoomed out,
 *   <1 = zoomed in) — camera-agnostic because the lot size cancels
 *   (viewMetres = fitViewMetres / zoom). Bands are expressed as multiples of
 *   the fit view, e.g. sketch ink [0.1, 2] means "visible from 10× zoom-in
 *   until 2× zoom-out". Edges CROSS-FADE over ±fadeFraction of the edge
 *   scale (alpha lerp, nominal edge = 50%), never hard-swap — zooming out
 *   fades the detail away instead of popping it.
 *
 * EXPLICIT NON-GOALS (do not build, recorded for future agent cycles):
 *   - No R-tree / R*-tree spatial index. Linear stroke rendering is fine at
 *     current counts; if a performance wall ever appears, the fix is a flat
 *     spatial grid first, and the re-association contract below binds it.
 *   - No automatic gesture parsing/compression. The explicit "Tidy" rail
 *     action (sketchCad.ts) is the correct UX — never auto-consume ink.
 *   - Never alter the stored `width_px` on CanvasStroke. Screen-constant
 *     sketch ink width is an intentional readability feature; only
 *     telemetry-driven variations (pressure/tilt) are computed at runtime.
 *
 * FUTURE SPATIAL INDEX CONTRACT (stroke re-association across pan sessions):
 *   When a spatial index for sketchStrokes is ever built, the insert rule is
 *   CONTAINMENT-ON-INSERT: a new stroke's bbox joining an existing cluster
 *   node iff it falls within that node's (expanded) bbox — NEVER
 *   nearest-neighbour grouping. A pan-away-and-return workflow must rejoin
 *   the original LocalDetailNode, not spawn a sibling. (Documented now; the
 *   index itself is a non-goal until stroke counts demand it.)
 */

import type { CanvasMode } from "../../../lib/canvas-mode";

export type CanvasLayerPolicy = {
  /** Force the subsurface blueprint ground (vellum + utilities). */
  subsurface: boolean;
  /** BYDA utility runs + services corridors render. */
  utilities: boolean;
  /** Easement rings render. */
  easements: boolean;
  /**
   * Resting ground albedo — what the ONE ground surface reads as when the
   * subsurface view is not armed.
   *
   * "paper" — the drafting contexts (survey/sketch/cad/elevation). The ground
   * mesh spans GROUND_CONTEXT_EXTENT boards, which is 2.3x the visible frame at
   * zoom 1, so its albedo IS what the operator calls "the background". Painting
   * it `--gs-canvas` is the only way `#F4F4F4` is reachable without zooming out
   * past 0.43 — the drawing is the product, and the drawing sits on paper.
   * "site" — the material contexts (garden/quote/present/share), where the
   * ground is a real surface being specified and the warm olive belongs.
   *
   * Replaces the `draftingSurface` flag, which every branch returned false for
   * since it was introduced — the drafting-grey ground was never reachable.
   */
  groundAlbedo: "paper" | "site";
};

export function canvasLayerPolicy(mode: CanvasMode): CanvasLayerPolicy {
  switch (mode) {
    case "sketch":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        groundAlbedo: "paper",
      };
    case "cad":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        groundAlbedo: "paper",
      };
    case "survey":
      return {
        // NOT armed on entry (2026-08-22). Survey used to force the subsurface
        // view, which lerps the ground to the blueprint vellum — so Step 0, the
        // one mode whose job is establishing the digital twin on paper, was the
        // only mode that never showed paper. The Underground rail toggle is the
        // operator override this policy already documents at line 16; survey
        // still OWNS the subsurface works, it just does not force the view.
        subsurface: false,
        utilities: true,
        easements: true,
        groundAlbedo: "paper",
      };
    case "elevation":
      return {
        subsurface: false,
        utilities: false,
        easements: true,
        groundAlbedo: "paper",
      };
    default:
      // garden | quote | present | share — presentation contexts, where the
      // ground is a material being specified rather than a sheet to draw on.
      return {
        subsurface: false,
        utilities: true,
        easements: true,
        groundAlbedo: "site",
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Scale-band layer visibility (macro-zoom cleanup)                        */
/* -------------------------------------------------------------------------- */

/**
 * The scale-banded data layers. The drawing-scale mapping is documented per
 * band in terms of the fit view: at zoom=1 (fit) the whole site is on screen
 * (≈ a working 1:50 plan); ratio 10 is the maximum zoom-out (≈ 1:500+).
 */
export type ScaleLayerKey =
  | "sketchInk" // artistic ink + hatching — the doc's "1:1 … 1:50" band
  | "cadLinework" // converted CAD linework + accepted geometry — "1:50 … 1:500"
  | "dims" // working-drawing dimension ring
  | "plantSymbol" // placed planting / hardscape graphics — "1:50 … 1:200"
  | "siteFrame"; // title boundary, building, easements, services — the anchor

export interface ScaleBandWindow {
  /** Visible range as multiples of the fit view (ratio = 1/zoom). */
  minFit: number;
  /** Infinity = always visible (the site-frame anchor). */
  maxFit: number;
  /** Cross-fade width as a FRACTION of each edge's scale (~±5%). */
  fadeFraction: number;
}

export const SCALE_BANDS: Record<ScaleLayerKey, ScaleBandWindow> = {
  // Detail ink survives deep zoom-in (10×) and fades out past 2× zoom-out.
  sketchInk: { minFit: 0.1, maxFit: 2, fadeFraction: 0.05 },
  // Planting graphics: visible from ~3× zoom-in until 3.5× zoom-out.
  plantSymbol: { minFit: 0.3, maxFit: 3.5, fadeFraction: 0.05 },
  // Dimension ring: working-drawing read, gone by 4× zoom-out.
  dims: { minFit: 0.3, maxFit: 4, fadeFraction: 0.05 },
  // Converted CAD linework survives to 8× zoom-out (≈1:400).
  cadLinework: { minFit: 0.2, maxFit: 8, fadeFraction: 0.05 },
  // The site truth frame NEVER fades — it is the macro anchor.
  siteFrame: { minFit: 0, maxFit: Infinity, fadeFraction: 0.05 },
};

/**
 * The normalized view scale: `1 / zoom` (1 = fit, >1 = zoomed out). Pure
 * camera-zoom inversion — the lot size cancels out of the visible-metres
 * ratio, so this is camera-agnostic (plan and 3D share the rig zoom).
 */
export function viewScaleRatioForZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? 1 / zoom : 1;
}

/**
 * The alpha cross-fade for a scale-banded layer at a given view ratio.
 *
 * Inside the window → 1. Each edge cross-fades over ±fadeFraction of the
 * edge scale: at the nominal edge the layer sits at 50% (the fade straddles
 * the boundary), reaching 0/1 at the ±5% window bounds. Linear lerp — the
 * "alpha lerp over a scale delta" the operator asked for — so zooming out
 * dissolves detail instead of popping it.
 */
export function layerScaleAlpha(
  key: ScaleLayerKey,
  viewScaleRatio: number,
): number {
  const band = SCALE_BANDS[key];
  const f = band.fadeFraction;
  const ratio = Number.isFinite(viewScaleRatio) ? viewScaleRatio : 1;

  const minLo = band.minFit * (1 - f);
  const minHi = band.minFit * (1 + f);
  const maxLo = band.maxFit * (1 - f);
  const maxHi = band.maxFit * (1 + f);

  let alpha = 1;
  if (ratio < minLo) return 0;
  if (ratio < minHi) alpha = (ratio - minLo) / (minHi - minLo);
  else if (ratio > maxHi) return 0;
  else if (ratio > maxLo) alpha = (maxHi - ratio) / (maxHi - maxLo);
  return Math.max(0, Math.min(1, alpha));
}

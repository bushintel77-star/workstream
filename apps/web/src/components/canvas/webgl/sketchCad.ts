/**
 * Gold Standard 2026 — WebGL sketch → CAD bridge (board-% ink → typed
 * proposals / features).
 *
 * The native wiring of the two classifier paths the SVG studio already
 * proved, into the fused WebGL studio:
 *
 *   1. `proposeSketchCad` — the context-aware classifier
 *      (`interpretSketchStrokesToCad`: masses, hedges, frenchdrain,
 *      canopy/olive-standard, hatching + duplicate disambiguation) as the
 *      primary "tidy strokes" path. Output is a confidence-scored ghost
 *      proposal set for the accept/reject review (the SVG
 *      `proposeFromStrokes` pattern). Centres are constrained into outdoor
 *      at PROPOSE time (same semantics as SVG — the ghost shows where the
 *      accepted asset will land).
 *   2. `convertStrokesToFeatures` — the simpler direct-conversion case:
 *      `recognizeStroke` + `buildLandscapeFeatureFromStroke` per stroke,
 *      gated at confidence ≥ 0.55 (the SVG `StudioAssistPanel.convertStrokes`
 *      gate). Output is real `LandscapeFeature[]` persisted into
 *      `DesignCanvas.features`.
 *
 * Source-ink decision (matches SVG on both paths): strokes stay visible as
 * reference ink after formalize AND after convert — ink is the honest
 * provenance of the converted entities, and both studios keep the same
 * behaviour at the one place they are coupled (the persisted canvas).
 */

import { clampBoardPct } from "@workstream/contracts";
import type {
  CanvasStroke,
  LandscapeFeature,
  SketchCanvas,
} from "@workstream/contracts";
import {
  buildLandscapeFeatureFromStroke,
  featureFromRecognizedStroke,
  interpretSketchStrokesToCad,
  recognizeStroke,
} from "@workstream/domain";
import { constrainAssetCentre } from "../handoff/geometry/outdoorClamp";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { kindPlane, planeZ } from "./planeStack";
import type { PctPoint } from "./coordTransform";
import {
  isStandingCanvas,
  reconcileWallFootprint,
  wallFromStandingStroke,
} from "./wallSeam";

export type SketchCadProposal = {
  /** Unique proposal id (derived from the stroke cluster it came from). */
  id: string;
  symbol_id: string;
  x_pct: number;
  y_pct: number;
  confidence: number;
  reason: string;
  /** Suggested glyph scale (classifier hint; falls back to confidence). */
  scale?: number;
  rotDeg?: number;
  /**
   * Decimated drawn outline (board %, ≥3 points) for closed area masses —
   * persists as a mirrored LandscapeFeature on accept so the drawn region
   * (deck / lawn / bed) survives the placement contract round-trip.
   */
  outlinePct?: PctPoint[];
};

/** Direct-conversion confidence gate — matches SVG StudioAssistPanel. */
const MIN_DIRECT_CONFIDENCE = 0.55;

/**
 * Would this stroke be convertible by `convertStrokesToFeatures`? The Tidy
 * HUD spawn gate uses the same confidence bar as the conversion itself, so
 * the HUD never appears for ink that could not commit (and the conversion
 * never accepts ink the HUD would have shown).
 */
export function isConvertibleStroke(stroke: CanvasStroke): boolean {
  if (stroke.hatch) return false;
  const rec = recognizeStroke(stroke);
  return !!rec && rec.confidence >= MIN_DIRECT_CONFIDENCE;
}

/** Scale fallback for proposals without a classifier hint (SVG parity). */
export function proposalScale(
  confidence: number,
  scaleHint: number | undefined,
): number {
  if (scaleHint != null && Number.isFinite(scaleHint)) return scaleHint;
  return Math.max(0.5, Math.min(1.3, 0.55 + confidence * 0.7));
}

/**
 * Classify board-% freehand ink into confidence-scored CAD ghost proposals
 * (primary tidy path). Empty input / no convertible strokes → [].
 * Derived hatch fills (`stroke.hatch`) are decorative shading, not source
 * ink — excluded up front so a sun-hatch never polls the classifier.
 */
export function proposeSketchCad(
  strokes: CanvasStroke[],
  ctx: { boundary: PctPoint[]; building: PctPoint[] },
): SketchCadProposal[] {
  const source = strokes.filter((s) => !s.hatch);
  const suggestions = interpretSketchStrokesToCad(
    source.map((s) => ({
      id: s.id,
      points: (s.points ?? []).map((p) => ({ x: p.x_pct, y: p.y_pct })),
    })),
    {
      boundary: ctx.boundary.map((p) => ({ x: p.x, y: p.y })),
      building: ctx.building.map((p) => ({ x: p.x, y: p.y })),
    },
  );

  return suggestions.map((g) => {
    const type = mapSymbolToStudioType(g.symbol_id);
    const placed = constrainAssetCentre(
      g.x_pct,
      g.y_pct,
      type,
      ctx.boundary,
      ctx.building,
    );
    const dx = placed.x - g.x_pct;
    const dy = placed.y - g.y_pct;
    return {
      id: g.id,
      symbol_id: g.symbol_id,
      x_pct: clampBoardPct(placed.x),
      y_pct: clampBoardPct(placed.y),
      confidence: g.confidence,
      reason: placed.reason ? `${g.reason} · ${placed.reason}` : g.reason,
      scale: proposalScale(g.confidence, g.scaleHint),
      rotDeg: g.rotDeg ?? 0,
      outlinePct:
        g.outlinePct && g.outlinePct.length >= 3
          ? g.outlinePct.map((p) => ({
            x: clampBoardPct(p.x + dx),
            y: clampBoardPct(p.y + dy),
          }))
          : undefined,
    };
  });
}

/**
 * One-click direct conversion — `recognizeStroke` (ditch / path / wall /
 * bed) → real `LandscapeFeature`s. Strokes below the confidence gate are
 * counted as skipped, never silently dropped from the reply. Derived hatch
 * fills are skipped too (decorative shading, not convertible source ink).
 *
 * Z-plane routing: each recognized kind maps to a depth-rail plane via
 * `KIND_TO_PLANE` (wall→massing +4.0, bed→planting +1.5, ditch/path→ground
 * 0.0) and the default is applied HERE, so both callers (one-click rail
 * Tidy and the inline HUD commit) land geometry on the classifier's plane.
 * A per-stroke `planeOverrides` entry (stroke id → Z) replaces the default —
 * this is how the HUD cycle toggle routes a corrected classification before
 * commit. The Z is stamped as `plane_z_m` on the feature (never
 * `extrude_height_m`, which means cut/fill pad).
 */
export function convertStrokesToFeatures(
  strokes: CanvasStroke[],
  planeOverrides?: Map<string, number>,
  /** Phase 4 seam context — canvas poses + site truth. When provided, a
   *  CLOSED stroke on a geometrically-standing canvas converts as a wall
   *  (docs/PHASE4-SEAM-DECISION-2026.md D1/D2) instead of going through the
   *  plan classifier, which cannot see drawn height. */
  opts?: {
    canvases?: SketchCanvas[];
    scaleM?: number;
    boardAspect?: number;
    boundaryPct?: PctPoint[];
  },
): {
  features: LandscapeFeature[];
  converted: number;
  skipped: number;
} {
  const features: LandscapeFeature[] = [];
  let skipped = 0;
  for (const stroke of strokes) {
    if (stroke.hatch) {
      skipped += 1;
      continue;
    }
    // Phase 4 seam — standing-canvas wall branch. The closed outline on a
    // standing plane IS a wall by construction (geometry, not
    // classification), so it bypasses the plan recognizer entirely. Open or
    // degenerate standing-canvas ink is skipped with the counter — it must
    // NOT fall through to the plan classifier, which would misread
    // elevation-space geometry.
    const sourceCanvas =
      stroke.canvas_id != null
        ? opts?.canvases?.find((c) => c.id === stroke.canvas_id)
        : undefined;
    if (
      sourceCanvas &&
      isStandingCanvas(sourceCanvas) &&
      opts?.scaleM != null &&
      opts?.boardAspect != null
    ) {
      const wall = wallFromStandingStroke(
        stroke,
        sourceCanvas,
        opts.scaleM,
        opts.boardAspect,
      );
      if (!wall) {
        skipped += 1;
        continue;
      }
      const rec = reconcileWallFootprint(
        wall.footprintPct,
        opts.boundaryPct ?? [],
      );
      const feature = buildLandscapeFeatureFromStroke({
        kind: "wall",
        // The domain builder's point contract is {x_pct, y_pct}; the seam
        // module returns board points in the coordTransform shape {x, y}.
        points: wall.footprintPct.map((p) => ({ x_pct: p.x, y_pct: p.y })),
        planeZ: planeZ(kindPlane("wall")),
        closed: true,
      });
      features.push({
        ...feature,
        drawn_height_m: wall.drawnHeightM,
        height_source: "operator",
        ...(rec.kind === "crosses" ? { boundary_cross: true } : {}),
      });
      continue;
    }
    const rec = recognizeStroke(stroke);
    if (!rec || rec.confidence < MIN_DIRECT_CONFIDENCE) {
      skipped += 1;
      continue;
    }
    const targetZ = planeOverrides?.get(stroke.id) ?? planeZ(kindPlane(rec.kind));
    features.push(featureFromRecognizedStroke(stroke, rec, undefined, targetZ));
  }
  return { features, converted: features.length, skipped };
}

/**
 * Phase 4 seam — would this stroke convert as a standing-canvas wall? The
 * Tidy HUD spawn gate uses it alongside `isConvertibleStroke` so wall ink
 * gets the same commit prompt (with its plane/height/reconciliation preset)
 * that ground ink gets.
 */
export function isWallCandidateStroke(
  stroke: CanvasStroke,
  canvases: SketchCanvas[] | undefined,
  scaleM: number,
  boardAspect: number,
): boolean {
  const canvas =
    stroke.canvas_id != null
      ? canvases?.find((c) => c.id === stroke.canvas_id)
      : undefined;
  if (!canvas || !isStandingCanvas(canvas)) return false;
  return wallFromStandingStroke(stroke, canvas, scaleM, boardAspect) != null;
}

/**
 * Photo-trace strokes are plane-metre (elevation-space) artifacts, not
 * board-% plan geometry — the plan classifiers do not apply to them. They
 * are explicitly scoped out of both conversion paths with this stamped,
 * visible notice rather than silently excluded.
 */
export function photoTraceScopeNotice(strokeCount: number): string {
  return (
    `${strokeCount} photo-traced stroke${strokeCount === 1 ? "" : "s"} are ` +
    "elevation-space (plane metres) and are not converted to CAD — they " +
    "remain on their elevation sheet."
  );
}

const PROPOSAL_FEATURE_LAYERS: Partial<
  Record<string, "hardscape" | "softscape_beds">
> = {
  deck: "hardscape",
  "bluestone-paver": "hardscape",
  lawn: "softscape_beds",
  "lomandra-mass": "softscape_beds",
};

/**
 * The accepted-proposal outline mirror — a Polygon LandscapeFeature whose id
 * mirrors the placement id, exactly the `itemsToFeatures` coupling the SVG
 * studio writes (`canvasBridge.ts`), so the drawn region round-trips across
 * both surfaces through `DesignCanvas.features`. Null for point proposals.
 *
 * PARAMETRIC ROUND-TRIP CONTRACT — the app uses the FORK model, not the
 * dissolve model:
 *   - Tidy keeps source ink as provenance: accepting a proposal mirrors an
 *     outline feature but NEVER deletes the constituent strokes.
 *   - Editing a constituent stroke afterwards does NOT dissolve or invalidate
 *     the mirrored feature. The feature is a snapshot of the drawn outline at
 *     accept time; the ink and the CAD entity are decoupled by design.
 *   - Re-running Tidy simply re-proposes from the (edited) ink; the operator
 *     decides whether to accept a new mirror. There is no automatic
 *     re-parse and no implicit feature mutation.
 *   Do not "fix" this to auto-sync ink → feature on edit: it would violate
 *   the operator's explicit accept/reject agency (see layerPolicy.ts
 *   NON-GOALS — no automatic gesture parsing).
 */
export function featureForAcceptedProposal(
  placementId: string,
  proposal: SketchCadProposal,
): LandscapeFeature | null {
  const outline = proposal.outlinePct;
  if (!outline || outline.length < 3) return null;
  const layer = PROPOSAL_FEATURE_LAYERS[proposal.symbol_id];
  if (!layer) return null;
  return {
    id: placementId,
    type: "LandscapeFeature",
    metadata: {
      layer,
      timestamp_created: new Date().toISOString(),
      source_attribution: "human_drawn",
      user_modification_state: "accepted",
    },
    geometry: {
      type: "Polygon",
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: outline.map((p, i) => ({
        id: `${placementId}-v${i}`,
        pct: { x_pct: clampBoardPct(p.x), y_pct: clampBoardPct(p.y) },
      })),
    },
    material_fill: {
      type: "surface",
      sku: proposal.symbol_id,
      depth_m: 0.075,
      waste_allocation_pct: 10,
    },
  };
}

/** Operator-facing labels for the classifier's symbol vocabulary. */
export const PROPOSAL_LABELS: Record<string, string> = {
  hedge: "Hedge screen",
  frenchdrain: "French drain",
  "bluestone-paver": "Bluestone path",
  deck: "Deck",
  lawn: "Lawn panel",
  "lomandra-mass": "Mass planting bed",
  canopy: "Shade canopy",
  "olive-standard": "Feature tree",
};

export function proposalLabel(symbolId: string): string {
  return PROPOSAL_LABELS[symbolId] ?? symbolId;
}

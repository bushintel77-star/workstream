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

import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import {
  featureFromRecognizedStroke,
  interpretSketchStrokesToCad,
  recognizeStroke,
} from "@workstream/domain";
import { constrainAssetCentre } from "../handoff/geometry/outdoorClamp";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import type { PctPoint } from "./coordTransform";

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

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
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
      x_pct: clampPct(placed.x),
      y_pct: clampPct(placed.y),
      confidence: g.confidence,
      reason: placed.reason ? `${g.reason} · ${placed.reason}` : g.reason,
      scale: proposalScale(g.confidence, g.scaleHint),
      rotDeg: g.rotDeg ?? 0,
      outlinePct:
        g.outlinePct && g.outlinePct.length >= 3
          ? g.outlinePct.map((p) => ({
              x: clampPct(p.x + dx),
              y: clampPct(p.y + dy),
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
 */
export function convertStrokesToFeatures(strokes: CanvasStroke[]): {
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
    const rec = recognizeStroke(stroke);
    if (!rec || rec.confidence < MIN_DIRECT_CONFIDENCE) {
      skipped += 1;
      continue;
    }
    features.push(featureFromRecognizedStroke(stroke, rec));
  }
  return { features, converted: features.length, skipped };
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
        pct: { x_pct: clampPct(p.x), y_pct: clampPct(p.y) },
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

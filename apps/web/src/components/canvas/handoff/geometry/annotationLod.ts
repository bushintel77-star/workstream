/**
 * Semantic zoom for plan annotations — canvas UX strategy §2.
 *
 * At wide zoom, dimension strings and edge labels overlap into illegibility.
 * Level-of-detail aggregates rather than overlaps:
 *   low  — boundary geometry + lot area
 *   mid  — + principal (longest) dims + dwelling/outdoor chips
 *   high — every decluttered edge, species labels, RL
 *
 * Thresholds align mid→high with the precision CAD skin (`ui.zoom >= 2.2`).
 * Soft ramps cross-fade instead of hard cuts.
 */

import { clampZoom } from "./canvasZoom";

export type AnnotationLodTier = "low" | "mid" | "high";

export type AnnotationLod = {
  tier: AnnotationLodTier;
  /** Lot area chip — present from overview up. */
  lotArea: boolean;
  /** Dwelling / outdoor schedule chips — mid+. */
  contextAreas: boolean;
  /** Outside dimension strings (principal or full). */
  dims: boolean;
  /** High: every decluttered edge; mid: longest only. */
  allEdgeDims: boolean;
  /** Cap for mid-tier principal dims after declutter. */
  principalMax: number;
  /** Species labels (presentation fidelity still required at the mount). */
  species: boolean;
  /** Spot RL / fall text labels. */
  rl: boolean;
  opacity: {
    lotArea: number;
    contextAreas: number;
    dims: number;
    species: number;
    rl: number;
  };
};

/** Enter mid tier — principal dims + context area chips. */
export const ANNOTATION_LOD_MID = 0.85;

/** Enter high tier — full edge set, species, RL (matches precisionOn). */
export const ANNOTATION_LOD_HIGH = 2.2;

/** Soft cross-fade band around each threshold (zoom units). */
export const ANNOTATION_LOD_FADE = 0.12;

/** Mid-zoom: keep the longest N decluttered edges. */
export const ANNOTATION_LOD_PRINCIPAL_MAX = 6;

/** 0 below enter−fade, 1 at/above enter, linear in between. */
export function lodRamp(
  zoom: number,
  enter: number,
  fade: number = ANNOTATION_LOD_FADE,
): number {
  if (!(zoom > 0) || !Number.isFinite(zoom)) return 0;
  if (fade <= 0) return zoom >= enter ? 1 : 0;
  if (zoom <= enter - fade) return 0;
  if (zoom >= enter) return 1;
  return (zoom - (enter - fade)) / fade;
}

export function resolveAnnotationLod(zoom: number): AnnotationLod {
  const z = clampZoom(zoom);
  const midIn = lodRamp(z, ANNOTATION_LOD_MID);
  const highIn = lodRamp(z, ANNOTATION_LOD_HIGH);
  const tier: AnnotationLodTier =
    z >= ANNOTATION_LOD_HIGH ? "high" : z >= ANNOTATION_LOD_MID ? "mid" : "low";

  return {
    tier,
    lotArea: true,
    contextAreas: midIn > 0.02,
    dims: midIn > 0.02,
    allEdgeDims: highIn >= 1,
    principalMax: ANNOTATION_LOD_PRINCIPAL_MAX,
    species: highIn > 0.02,
    rl: highIn > 0.02,
    opacity: {
      lotArea: 1,
      contextAreas: midIn,
      dims: midIn,
      species: highIn,
      rl: highIn,
    },
  };
}

/**
 * Apply LOD to decluttered outside dims: hide all at low zoom; keep the
 * longest `principalMax` at mid; pass through at high.
 */
export function filterDimsForAnnotationLod<
  T extends { key: string; lengthM: number; visible: boolean },
>(dims: T[], lod: AnnotationLod): T[] {
  if (!lod.dims || lod.opacity.dims < 0.02) {
    return dims.map((d) => ({ ...d, visible: false }));
  }
  if (lod.allEdgeDims) return dims;

  const ranked = dims
    .filter((d) => d.visible)
    .slice()
    .sort(
      (a, b) =>
        b.lengthM - a.lengthM || a.key.localeCompare(b.key),
    );
  const keep = new Set(
    ranked.slice(0, lod.principalMax).map((d) => d.key),
  );
  return dims.map((d) => ({
    ...d,
    visible: d.visible && keep.has(d.key),
  }));
}

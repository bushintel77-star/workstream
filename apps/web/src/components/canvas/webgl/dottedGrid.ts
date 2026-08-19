/**
 * Dotted infinity-canvas field — spacing tiers + focal point.
 *
 * The studio ground uses a procedural dot field instead of line grids:
 * dots are sparse sample points on a plane that keeps going past the
 * viewport (Figma/Miro/Blender device), with no hard intersections to
 * box the viewport in and nothing to flicker as the camera zooms.
 *
 * Spacing lives in WORLD space, so zooming out compresses the field
 * toward denser coverage (moving through space, not zooming a photo of a
 * grid). Three discrete densities switch at camera-height thresholds with
 * a cross-fade band, Figma-style — close sketching and full-site overview
 * each get an intentional density.
 */

/** World-space dot spacings in metres, tightest first. */
export const GRID_SPACINGS = [2.5, 10, 40] as const;

/** Camera height (m) thresholds between the density tiers. */
export const GRID_TIER_THRESHOLDS = [55, 150] as const;

/** Fraction of each threshold used as the cross-fade band (no pops). */
export const GRID_BLEND_BAND = 0.18;

export type GridTier = {
  /** Primary world spacing in metres. */
  spacingA: number;
  /** Secondary spacing blended in near a threshold. */
  spacingB: number;
  /** 0..1 weight of spacingB. */
  blend: number;
};

/**
 * Pick the dot density for a camera height. Pure — unit-tested.
 * At height ≤ ~45 m: 2.5 m dots. 65–123 m: 10 m. ≥ ~177 m: 40 m.
 * Between: a smooth blend of the two adjacent tiers.
 */
export function gridTierFor(cameraHeight: number): GridTier {
  const [lo, hi] = GRID_TIER_THRESHOLDS;
  const band = GRID_BLEND_BAND;

  const blendAt = (threshold: number, lower: number, upper: number): GridTier => {
    const start = threshold * (1 - band);
    const end = threshold * (1 + band);
    if (cameraHeight <= start) return { spacingA: lower, spacingB: lower, blend: 0 };
    if (cameraHeight >= end) return { spacingA: upper, spacingB: upper, blend: 0 };
    return {
      spacingA: lower,
      spacingB: upper,
      blend: (cameraHeight - start) / (end - start),
    };
  };

  if (cameraHeight <= lo * (1 + band)) {
    return blendAt(lo, GRID_SPACINGS[0], GRID_SPACINGS[1]);
  }
  return blendAt(hi, GRID_SPACINGS[1], GRID_SPACINGS[2]);
}

/**
 * World-space focal point for the dot field's breathing falloff — plain
 * module refs, never React state: the frame loop reads them every frame
 * and pointer moves write them, so the breathing costs zero commits.
 */
export const gridFocal = { x: 0, z: 0, touched: false };

export function setGridFocal(x: number, z: number): void {
  gridFocal.x = x;
  gridFocal.z = z;
  gridFocal.touched = true;
}

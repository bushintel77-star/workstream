/**
 * Viewpoint filmstrip thumbnail capture (Phase C).
 *
 * Captures a downscaled PNG thumbnail from the live WebGL canvas for use as
 * a viewpoint filmstrip thumb (82x52 per handoff ss4 Geometry).
 *
 * The core cropping math is pure (no DOM dependency) so it is unit-testable
 * in Node. The `captureViewpointThumbnail` wrapper calls the pure cropper
 * with a real `document.createElement("canvas")` at runtime.
 */

/** Target thumbnail width per ss4 Geometry (viewpoint filmstrip thumbs 82x52). */
export const THUMB_W = 82;
/** Target thumbnail height per ss4 Geometry. */
export const THUMB_H = 52;

/** A minimal canvas-like surface with a 2D context and toDataURL. */
interface ThumbCanvas {
  width: number;
  height: number;
  getContext(type: "2d"): {
    drawImage(
      source: CanvasImageSource,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ): void;
  } | null;
  toDataURL(type: string): string;
}

/** A factory that creates a fresh thumb canvas of the given dimensions. */
type ThumbCanvasFactory = (w: number, h: number) => ThumbCanvas;

/**
 * Pure crop math: compute the source-rectangle (sx, sy, sw, sh) for a
 * "cover" crop from source dimensions into the target aspect ratio.
 *
 * Returns null if the source has zero dimensions.
 */
export function coverCropRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  if (srcW === 0 || srcH === 0) return null;
  const targetAspect = destW / destH;
  const srcAspect = srcW / srcH;
  if (srcAspect > targetAspect) {
    // Source is wider — crop horizontally.
    const sw = srcH * targetAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  // Source is taller (or equal) — crop vertically.
  const sh = srcW / targetAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/**
 * Pure thumbnail renderer: takes a source canvas + a thumb-canvas factory,
 * draws the cover-cropped source into a fresh thumb canvas, and returns the
 * data URL. Returns null on zero-dim source, null context, or toDataURL
 * failure (tainted canvas).
 */
export function renderViewpointThumbnail(
  source: ThumbCanvas,
  factory: ThumbCanvasFactory,
  width: number = THUMB_W,
  height: number = THUMB_H,
): string | null {
  const rect = coverCropRect(source.width, source.height, width, height);
  if (!rect) return null;

  const thumb = factory(width, height);
  const ctx = thumb.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(
    source as unknown as CanvasImageSource,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    0,
    0,
    width,
    height,
  );
  try {
    return thumb.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Capture a PNG data URL thumbnail from a live HTMLCanvasElement.
 *
 * This is the runtime entry point — it uses `document.createElement("canvas")`
 * for the thumb surface. The pure `renderViewpointThumbnail` is used in tests
 * with a mock factory.
 */
export function captureViewpointThumbnail(
  source: HTMLCanvasElement,
  width: number = THUMB_W,
  height: number = THUMB_H,
): string | null {
  return renderViewpointThumbnail(
    source as unknown as ThumbCanvas,
    (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c as unknown as ThumbCanvas;
    },
    width,
    height,
  );
}

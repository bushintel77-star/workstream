/** Shared % ↔ screen transforms (mirrors apps/web/src/utils/studioTransform.ts). */

export function percentToScreen(
  pctX: number,
  pctY: number,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  return {
    x: width * (pctX / 100) * zoom + panX,
    y: height * (pctY / 100) * zoom + panY,
  };
}

export function screenToPercent(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  return {
    x: ((screenX - panX) / zoom / width) * 100,
    y: ((screenY - panY) / zoom / height) * 100,
  };
}

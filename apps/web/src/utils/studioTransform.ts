/** Runtime % ↔ screen px transforms for Workflow 1 studio canvas. */

export type CanvasRect = Pick<DOMRect, "width" | "height" | "left" | "top">;

export function percentToScreen(
  pctX: number,
  pctY: number,
  canvasRect: CanvasRect,
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  return {
    x: canvasRect.width * (pctX / 100) * zoom + panX,
    y: canvasRect.height * (pctY / 100) * zoom + panY,
  };
}

export function screenToPercent(
  screenX: number,
  screenY: number,
  canvasRect: CanvasRect,
  zoom: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  return {
    x: ((screenX - panX) / zoom / canvasRect.width) * 100,
    y: ((screenY - panY) / zoom / canvasRect.height) * 100,
  };
}

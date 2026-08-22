import type { PctPoint } from "./types";
import { toBoardPctPoint } from "./boardPct";

/**
 * Camera matching `.zoomWorld`:
 *   transform-origin: focusX% focusY%
 *   transform: translate(panXpx, panYpx) rotate(rotDeg) scale(zoom)
 *
 * CSS applies scale → rotate → translate around the origin (then pan).
 */

export type BoardCamera = {
  /** Layout width of the plan board (CSS px, untransformed). */
  boardW: number;
  boardH: number;
  zoom: number;
  /** Degrees clockwise (same as ui.viewRotationDeg). */
  rotateDeg: number;
  panX: number;
  panY: number;
  focusX: number;
  focusY: number;
};

/** Screen point → board % under the current camera (inverts zoomWorld). */
export function clientToBoardPct(
  clientX: number,
  clientY: number,
  boardRect: { left: number; top: number },
  cam: BoardCamera,
): PctPoint {
  const w = Math.max(1, cam.boardW);
  const h = Math.max(1, cam.boardH);
  const zoom = Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 1;
  const ox = (cam.focusX / 100) * w;
  const oy = (cam.focusY / 100) * h;
  const sx = clientX - boardRect.left - cam.panX - ox;
  const sy = clientY - boardRect.top - cam.panY - oy;
  const rad = (-cam.rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = sx * cos - sy * sin;
  const ry = sx * sin + sy * cos;
  const lx = ox + rx / zoom;
  const ly = oy + ry / zoom;
  return toBoardPctPoint({
    x: Number(((lx / w) * 100).toFixed(4)),
    y: Number(((ly / h) * 100).toFixed(4)),
  });
}

/** Board % → screen px relative to board top-left (for tests / guides). */
export function boardPctToClientOffset(
  pct: PctPoint,
  cam: BoardCamera,
): { x: number; y: number } {
  const w = Math.max(1, cam.boardW);
  const h = Math.max(1, cam.boardH);
  const zoom = Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 1;
  const ox = (cam.focusX / 100) * w;
  const oy = (cam.focusY / 100) * h;
  const lx = (pct.x / 100) * w;
  const ly = (pct.y / 100) * h;
  const dx = (lx - ox) * zoom;
  const dy = (ly - oy) * zoom;
  const rad = (cam.rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return {
    x: cam.panX + ox + rx,
    y: cam.panY + oy + ry,
  };
}

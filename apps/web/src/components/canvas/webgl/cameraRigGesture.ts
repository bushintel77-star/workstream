/**
 * Camera rig gestures — pure math for pan-drag and pointer-anchored wheel
 * zoom, extracted from StudioControls so the hot path is testable and stays
 * free of React state.
 *
 * The contract that keeps the render loop at 60fps:
 *   - `panDragMove` returns the NEXT live rig but never commits anything —
 *     StudioControls writes it to the transient store (getState().setLiveRig)
 *     with zero React re-renders.
 *   - The COMMIT (React state sync) happens exactly once per gesture, on
 *     pointer-up, via `onRigChange(liveRig)`.
 */
import type { StudioCameraRig } from "./cameraRig";

export interface PanDragState {
  active: boolean;
  isPan: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  moved: boolean;
}

/** Open a drag at a pointer origin, anchored to the current (live) rig. */
export function beginPanDrag(rig: StudioCameraRig, x: number, y: number): PanDragState {
  return {
    active: true,
    isPan: false,
    startX: x,
    startY: y,
    startPanX: rig.panX,
    startPanY: rig.panY,
    moved: false,
  };
}

export interface PanDragMoveResult {
  /** Whether the drag has crossed the 3px threshold (pan is live). */
  isPan: boolean;
  /** The next live rig — equals the input rig below the threshold. */
  nextRig: StudioCameraRig;
}

/**
 * Advance a pan drag. World delta is derived from the pointer delta against
 * the drag's START pan (so the pan is anchored to where the gesture began,
 * not chasing the latest value — no mid-drag jump). Pure: returns the next
 * rig without writing any state.
 */
export function panDragMove(
  drag: PanDragState,
  rig: StudioCameraRig,
  x: number,
  y: number,
): PanDragMoveResult {
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  const isPan = drag.isPan || Math.abs(dx) > 3 || Math.abs(dy) > 3;
  if (!isPan) return { isPan: false, nextRig: rig };
  // Screen px delta → world units (inverted for natural drag).
  const worldDx = -dx / (rig.zoom * 8);
  const worldDy = dy / (rig.zoom * 8);
  return {
    isPan: true,
    nextRig: {
      ...rig,
      panX: drag.startPanX + worldDx,
      panY: drag.startPanY + worldDy,
    },
  };
}

/**
 * Wheel zoom anchored at the pointer: the pan shifts toward the cursor
 * proportional to the zoom delta, clamped to a fraction of the lot scale so a
 * single wheel delta can't fling the camera. Pure — returns the next rig.
 */
export function zoomRigAt(
  rig: StudioCameraRig,
  deltaY: number,
  px: number,
  py: number,
  rect: { width: number; height: number },
  scaleM: number,
): StudioCameraRig {
  const factor = deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.min(Math.max(rig.zoom * factor, 0.1), 50);

  // Normalised to [-1, 1]
  const nx = (px / rect.width) * 2 - 1;
  const ny = -(py / rect.height) * 2 + 1;

  // Shift pan towards the pointer proportional to the zoom delta.
  const zoomRatio = 1 - newZoom / Math.max(1e-6, rig.zoom);
  let panShiftX = nx * 5 * zoomRatio;
  let panShiftY = -ny * 5 * zoomRatio;

  // Clamp pan shifts to a fraction of the lot scale to avoid wild jumps.
  const maxShift = Math.max(1, scaleM * 0.5);
  panShiftX = Math.max(-maxShift, Math.min(maxShift, panShiftX));
  panShiftY = Math.max(-maxShift, Math.min(maxShift, panShiftY));

  return {
    ...rig,
    zoom: newZoom,
    panX: rig.panX + panShiftX,
    panY: rig.panY + panShiftY,
  };
}

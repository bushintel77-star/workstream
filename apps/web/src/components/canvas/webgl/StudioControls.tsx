/**
 * Gold Standard 2026 — pointer/keyboard input controller for the WebGL studio.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3–1.4
 *
 * Replaces the SVG board's clientToBoardPct + CSS-transform camera input.
 * Uses R3F's pointer events + raycasting for world-space coordinate picking,
 * and wheel/drag for camera pan/zoom.
 *
 * The controller renders an invisible ground-plane mesh that captures all
 * pointer events. Raycasting against this plane gives exact metre-space
 * world coordinates — the replacement for the old clientToBoardPct inverse
 * camera math.
 */

import { useRef, useCallback, type RefObject } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  beginPanDrag,
  panDragMove,
  zoomRigAt,
  type PanDragState,
} from "./cameraRigGesture";
import { worldToPct, type PctPoint } from "./coordTransform";
import { useSeasonalStore } from "./seasonalStore";
import { useStudioStore } from "./studioStore";

export interface StudioControlsProps {
  scaleM: number;
  boardAspect: number;
  /** Fired when the user clicks empty ground (not dragging). */
  onGroundClick?: (pct: PctPoint) => void;
  /** Fired on every pointer move with the current board-% position. */
  onCursorMove?: (pct: PctPoint | null) => void;
  /** Whether to lock editing under tilt (same rule as the old isTiltActive). */
  tiltLocked: boolean;
}

/**
 * Raycast the pointer against the z=0 ground plane to get world coords.
 * Returns null if the ray doesn't intersect (e.g. pointer is at the horizon
 * under heavy tilt).
 */
function raycastGround(
  event: ThreeEvent<PointerEvent>,
  groundRef: RefObject<THREE.Mesh | null>,
): [number, number] | null {
  if (!groundRef.current) return null;
  // R3F already computes intersections; we use the first point on the ground
  if (event.point) {
    return [event.point.x, event.point.z];
  }
  return null;
}

export function StudioControls({
  scaleM,
  boardAspect,
  onGroundClick,
  onCursorMove,
  tiltLocked,
}: StudioControlsProps) {
  const { gl } = useThree();
  const groundRef = useRef<THREE.Mesh>(null);
  const dragState = useRef<PanDragState>({
    active: false,
    isPan: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  /** Wheel zoom — anchored at the pointer.
   * Throttle rapid wheel events via requestAnimationFrame and clamp the
   * computed pan shift so a single wheel delta cannot produce an enormous
   * world offset (which previously caused the canvas/UI to fling).
   */
  const wheelPendingRef = useRef(false);
  const onWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      e.stopPropagation();
      if (tiltLocked) return; // zoom frozen under tilt (matches old behaviour)

      // Capture the event data synchronously and schedule a single update
      // per frame to avoid queuing multiple camera updates.
      const delta = e.nativeEvent.deltaY;
      const rect = gl.domElement.getBoundingClientRect();
      const px = e.nativeEvent.clientX - rect.left;
      const py = e.nativeEvent.clientY - rect.top;

      if (wheelPendingRef.current) {
        // Already scheduled for this frame — drop intermediate events.
        return;
      }
      wheelPendingRef.current = true;

      requestAnimationFrame(() => {
        wheelPendingRef.current = false;

        // Read the LIVE rig from the store, write the next rig back — the
        // store is the single source of truth for the camera (FusedCamera
        // reads it via getState() each frame). Wheel is discrete and
        // rAF-throttled, so this is one store write per frame at most.
        const live = useStudioStore.getState().liveRig;
        const next = zoomRigAt(live, delta, px, py, rect, scaleM);
        useStudioStore.getState().setLiveRig(next);
      });
    },
    [gl, tiltLocked, scaleM],
  );

  /** Pointer down — start tracking a potential drag. Yields the gesture when
   *  a capture layer is armed (sketch ink / measure tape / asset placement):
   *  without this, the early stopPropagation on this coplanar plane (mounted
   *  first in the scene) eats the pointerdown before those layers see it. */
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const { sketchMode: inkArmed, measureActive: tapeArmed, armedSymbolId: assetArmed } =
        useSeasonalStore.getState();
      if (inkArmed || tapeArmed || assetArmed != null) return; // capture layer wins
      e.stopPropagation();
      dragState.current = beginPanDrag(
        useStudioStore.getState().liveRig,
        e.nativeEvent.clientX,
        e.nativeEvent.clientY,
      );
    },
    [],
  );

  /** Pointer move — pan if dragging (unless sketchMode is on, in which case
   *  drags are strokes, not camera moves). Always report cursor position. */
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // When sketchMode is active, suppress camera pan so the drag becomes a
      // stroke captured by FusedSketchLayer's own raycast plane.
      const sketchActive = useSeasonalStore.getState().sketchMode;
      if (dragState.current.active && !sketchActive) {
        // Read the LIVE rig each move; write the next rig to the transient
        // store. NO React state write here — the frame loop reads it via
        // getState(), so a pan drag never triggers a React re-render.
        const live = useStudioStore.getState().liveRig;
        const { isPan, nextRig } = panDragMove(
          dragState.current,
          live,
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
        );
        if (isPan) {
          dragState.current.moved = true;
          dragState.current.isPan = true;
          useStudioStore.getState().setLiveRig(nextRig);
        }
      }

      // Report cursor position via raycast
      if (onCursorMove) {
        const world = raycastGround(e, groundRef);
        if (world) {
          onCursorMove(worldToPct(world[0], world[1], scaleM, boardAspect));
        } else {
          onCursorMove(null);
        }
      }
    },
    [onCursorMove, scaleM, boardAspect],
  );

  /** Pointer up — fire click if it wasn't a drag. The live rig stays in the
   *  store (single source of truth); no React commit is needed — the whole
   *  drag never touched React state. */
  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (dragState.current.active && !dragState.current.moved && onGroundClick) {
        const world = raycastGround(e, groundRef);
        if (world && !tiltLocked) {
          onGroundClick(worldToPct(world[0], world[1], scaleM, boardAspect));
        }
      }
      dragState.current.active = false;
      dragState.current.isPan = false;
    },
    [onGroundClick, scaleM, boardAspect, tiltLocked],
  );

  const groundSize = scaleM * 5;

  return (
    <>
      {/*
       * Invisible ground plane — captures all pointer events for the scene.
       * Sized larger than the lot so panning beyond the boundary still raycasts.
       */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          dragState.current.active = false;
          onCursorMove?.(null);
        }}
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

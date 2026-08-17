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

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  beginOrbitDrag,
  beginPanDrag,
  orbitDragMove,
  panDragMove,
  zoomRigAt,
  type OrbitDragState,
  type PanDragState,
} from "./cameraRigGesture";
import { blendTargetForPitch, isElevationRig, settleOrbitRig } from "./cameraRig";
import {
  beginTouchOrbit,
  isTwoFingerDoubleTap,
  touchOrbitMove,
  type TouchOrbitState,
  type TouchPoint,
} from "./touchOrbit";
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
}: StudioControlsProps) {  const { gl } = useThree();

  // Coalesce hover cursor reports to one write per animation frame — pointer
  // events fire at hundreds of Hz and each report would otherwise re-render
  // the DOM chrome column (mirrors the rAF cap in CadPlanBoard).
  const onCursorMoveRef = useRef(onCursorMove);
  onCursorMoveRef.current = onCursorMove;
  const cursorMoveCoalesced = useRef<((pct: PctPoint | null) => void) | null>(
    null,
  );
  if (!cursorMoveCoalesced.current) {
    let pending: PctPoint | null | undefined;
    let scheduled = false;
    cursorMoveCoalesced.current = (pct) => {
      pending = pct;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const value = pending;
        pending = undefined;
        if (value !== undefined) onCursorMoveRef.current?.(value);
      });
    };
  }

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
  const orbitState = useRef<OrbitDragState>({
    active: false,
    startX: 0,
    startY: 0,
    startTilt: 0,
    startAzimuth: 0,
    moved: false,
  });
  /** True while a two-finger touch gesture owns the camera (suppresses the
   *  pointer pan path so the extra fingers never pan the rig mid-orbit). */
  const twoFingerRef = useRef(false);

  /**
   * Native two-finger camera gestures — pinch zoom, twist azimuth, vertical
   * pitch. Single-finger touch rides the existing pointer path; the moment a
   * second finger lands we take over, and when the gesture ends we settle +
   * commit exactly once (the same contract as the desktop orbit release).
   */
  useEffect(() => {
    const el = gl.domElement;
    const touches = new Map<number, TouchPoint>();
    let orbitTouch: TouchOrbitState | null = null;
    let lastTwoFingerStart: number | null = null;

    const sync = (list: TouchList) => {
      const activeIds = new Set<number>();
      for (let i = 0; i < list.length; i++) {
        const t = list[i]!;
        activeIds.add(t.identifier);
        touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      for (const id of [...touches.keys()]) {
        if (!activeIds.has(id)) touches.delete(id);
      }
    };

    const advance = () => {
      const pts = [...touches.values()];
      if (pts.length < 2) return;
      if (!orbitTouch) {
        orbitTouch = beginTouchOrbit(
          useStudioStore.getState().liveRig,
          pts[0]!,
          pts[1]!,
        );
        twoFingerRef.current = true;
      }
      const moved = touchOrbitMove(
        orbitTouch,
        useStudioStore.getState().liveRig,
        pts[0]!,
        pts[1]!,
      );
      useStudioStore.getState().setLiveRig(moved.nextRig);
    };

    const endGesture = () => {
      if (!orbitTouch) return;
      const live = useStudioStore.getState().liveRig;
      const settled = settleOrbitRig(live);
      useStudioStore.getState().setLiveRig(settled);
      useStudioStore.getState().setViewBlendTarget(
        blendTargetForPitch(settled.tiltDeg),
      );
      useStudioStore.getState().setElevationActive(isElevationRig(settled));
      orbitTouch = null;
      twoFingerRef.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault(); // stop browser pinch/scroll on the canvas
        const now = Date.now();
        // Return to plan — two quick two-finger taps flatten the camera.
        if (isTwoFingerDoubleTap(lastTwoFingerStart, now)) {
          useStudioStore.getState().setPitchDeg(0);
          lastTwoFingerStart = null;
          return;
        }
        lastTwoFingerStart = now;
        sync(e.touches);
        advance();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
      sync(e.touches);
      advance();
    };
    const onTouchEnd = (e: TouchEvent) => {
      sync(e.touches);
      if (e.touches.length < 2) endGesture();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl]);

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
      if (twoFingerRef.current) return; // two-finger touch owns the camera
      const { sketchMode: inkArmed, measureActive: tapeArmed, armedSymbolId: assetArmed } =
        useSeasonalStore.getState();
      if (inkArmed || tapeArmed || assetArmed != null) return; // capture layer wins
      e.stopPropagation();

      // Cmd/Ctrl+drag orbits — pitch on the vertical axis, azimuth on the
      // horizontal. The single continuous camera gesture; plain drag pans.
      if (e.nativeEvent.metaKey || e.nativeEvent.ctrlKey) {
        orbitState.current = beginOrbitDrag(
          useStudioStore.getState().liveRig,
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
        );
        return;
      }

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
      if (twoFingerRef.current) return; // two-finger touch owns the camera
      // Modifier orbit — drives pitch + azimuth straight into the transient
      // live rig (zero React writes per move; FusedCamera derives the blend
      // from the live pitch each frame).
      if (orbitState.current.active) {
        const live = useStudioStore.getState().liveRig;
        const orbit = orbitDragMove(
          orbitState.current,
          live,
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
        );
        if (orbit.isOrbiting) {
          orbitState.current.moved = true;
          useStudioStore.getState().setLiveRig(orbit.nextRig);
        }
      }

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

      // Report cursor position via raycast — coalesced to one write per frame
      // so hover readouts never re-render the DOM chrome per pointer event.
      const reportCursor = cursorMoveCoalesced.current;
      if (onCursorMove && reportCursor) {
        const world = raycastGround(e, groundRef);
        if (world) {
          reportCursor(worldToPct(world[0], world[1], scaleM, boardAspect));
        } else {
          reportCursor(null);
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
      if (twoFingerRef.current) return; // two-finger touch owns the camera
      if (orbitState.current.active) {
        if (orbitState.current.moved) {
          // Settle the release: snap to the EXACT elevation state when the
          // drag ended near φ=90° + a facade normal. Commit the derived
          // plan/3D state and the elevation flag exactly once per gesture —
          // the camera axis itself stays in liveRig (the single source).
          const live = useStudioStore.getState().liveRig;
          const settled = settleOrbitRig(live);
          useStudioStore.getState().setLiveRig(settled);
          useStudioStore.getState().setViewBlendTarget(
            blendTargetForPitch(settled.tiltDeg),
          );
          useStudioStore.getState().setElevationActive(
            isElevationRig(settled),
          );
        }
        orbitState.current.active = false;
        orbitState.current.moved = false;
        return; // an orbit never fires a ground click
      }
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
          orbitState.current.active = false;
          onCursorMove?.(null);
        }}
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

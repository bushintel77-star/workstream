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
import { orbitAllowedForPreset } from "./cameraGate";
import {
  beginTouchOrbit,
  isTwoFingerDoubleTap,
  touchOrbitMove,
  type TouchOrbitState,
  type TouchPoint,
} from "./touchOrbit";
import { worldToPct, type PctPoint } from "./coordTransform";
import { setGridFocal } from "./dottedGrid";
import { useSeasonalStore } from "./seasonalStore";
import { useStudioStore } from "./studioStore";
import {
  MIN_MARQUEE_AREA_PCT,
  boxAreaPct,
  normalizeBox,
} from "./marqueeSelect";

export interface StudioControlsProps {
  scaleM: number;
  boardAspect: number;
  /** Fired when the user clicks empty ground (not dragging). `additive`
   *  carries the shift key — selection multi-select. */
  onGroundClick?: (pct: PctPoint, opts: { additive: boolean }) => void;
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

  // Tool-gated marquee state — refs so the pointer callbacks never go stale.
  const marqueeActive = useStudioStore((s) => s.marqueeActive);
  const marqueeActiveRef = useRef(marqueeActive);
  marqueeActiveRef.current = marqueeActive;
  const marqueeStartRef = useRef<PctPoint | null>(null);
  // Draft writes are coalesced to one per frame (the cursor-report pattern)
  // so a marquee drag never writes React state per pointer event.
  const marqueePendingRef = useRef<{ a: PctPoint; b: PctPoint } | null>(null);
  const marqueeScheduledRef = useRef(false);
  const marqueeEpochRef = useRef(0);
  const marqueeCoalesced = useRef<
    ((draft: { a: PctPoint; b: PctPoint }) => void) | null
  >(null);
  if (!marqueeCoalesced.current) {
    marqueeCoalesced.current = (draft) => {
      marqueePendingRef.current = draft;
      if (marqueeScheduledRef.current) return;
      marqueeScheduledRef.current = true;
      const epoch = marqueeEpochRef.current;
      requestAnimationFrame(() => {
        marqueeScheduledRef.current = false;
        const value = marqueePendingRef.current;
        marqueePendingRef.current = null;
        if (value && marqueeEpochRef.current === epoch) {
          useStudioStore.getState().setMarqueeDraft(value);
        }
      });
    };
  }
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
        // Phase G: In DRAW mode, two-finger orbit is locked (pinch zoom still works).
        if (useStudioStore.getState().drawViewMode === "DRAW") return;
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
      // Phase 5: Pause zoom during fly-through playback.
      if (useStudioStore.getState().isPlayingFlythrough) return;
      // Phase 8: Pedestrian camera owns zoom (no orbit zoom in walk mode).
      if (useStudioStore.getState().cameraPosture === "PEDESTRIAN") return;
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
   *  a capture layer is armed (sketch ink / measure tape / asset placement /
   *  precision drafting): without this, the early stopPropagation on this
   *  coplanar plane (mounted first in the scene) eats the pointerdown before
   *  those layers see it. */
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Phase 5: Pause all camera gestures during fly-through playback.
      if (useStudioStore.getState().isPlayingFlythrough) return;
      // Phase 8: Pedestrian camera owns pointer events for mouselook.
      if (useStudioStore.getState().cameraPosture === "PEDESTRIAN") return;
      // Phase G: In DRAW mode, orbit is locked (pan/zoom still work).
      if (useStudioStore.getState().drawViewMode === "DRAW") return;
      if (twoFingerRef.current) return; // two-finger touch owns the camera
      // The spatial gizmo owns its pointer events while a drag is in flight —
      // the ground plane must never start a pan/orbit under the gizmo.
      if (useStudioStore.getState().gizmoDragging) return;
      const {
        sketchMode: inkArmed,
        measureActive: tapeArmed,
        armedSymbolId: assetArmed,
        draftSession,
      } = useSeasonalStore.getState();
      if (inkArmed || tapeArmed || assetArmed != null || draftSession) {
        return; // capture layer wins
      }
      e.stopPropagation();

      // Cmd/Ctrl+drag orbits — pitch on the vertical axis, azimuth on the
      // horizontal. The single continuous camera gesture; plain drag pans.
      // Orbit is a 3D-only gesture (spec 1.4): PLAN and SEC never orbit.
      if (
        (e.nativeEvent.metaKey || e.nativeEvent.ctrlKey) &&
        orbitAllowedForPreset(useStudioStore.getState().cameraPreset)
      ) {
        orbitState.current = beginOrbitDrag(
          useStudioStore.getState().liveRig,
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
        );
        return;
      }

      // Tool-gated marquee: plain drag draws the selection box instead of
      // panning. The box lives in board-% (worldToPct of the ground ray).
      if (marqueeActiveRef.current) {
        const world = raycastGround(e, groundRef);
        if (world) {
          const pct = worldToPct(world[0], world[1], scaleM, boardAspect);
          dragState.current.active = true;
          dragState.current.moved = false;
          dragState.current.isPan = false;
          marqueeStartRef.current = pct;
          marqueeCoalesced.current?.({ a: pct, b: pct });
        }
        return;
      }

      dragState.current = beginPanDrag(
        useStudioStore.getState().liveRig,
        e.nativeEvent.clientX,
        e.nativeEvent.clientY,
      );
    },
    [scaleM, boardAspect],
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

      // Tool-gated marquee drag — updates the box draft; never pans.
      if (dragState.current.active && marqueeActiveRef.current) {
        dragState.current.moved = true;
        const start = marqueeStartRef.current;
        const world = raycastGround(e, groundRef);
        if (start && world) {
          marqueeCoalesced.current?.({
            a: start,
            b: worldToPct(world[0], world[1], scaleM, boardAspect),
          });
        }
        return;
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
          // The dotted ground field breathes toward the last interaction
          // point — plain module refs, zero React commits per move.
          setGridFocal(world[0], world[1]);
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
      // Tool-gated marquee finalize: a real box replaces (or unions) the
      // selection; a degenerate drag behaves like an empty-ground click.
      if (marqueeActiveRef.current && dragState.current.active) {
        const start = marqueeStartRef.current;
        marqueeStartRef.current = null;
        marqueeEpochRef.current += 1; // drop any in-flight draft write
        marqueePendingRef.current = null;
        useStudioStore.getState().setMarqueeDraft(null);
        const world = raycastGround(e, groundRef);
        const box =
          start && world
            ? normalizeBox(
              start,
              worldToPct(world[0], world[1], scaleM, boardAspect),
            )
            : null;
        dragState.current.active = false;
        dragState.current.isPan = false;
        dragState.current.moved = false;
        if (box && boxAreaPct(box) >= MIN_MARQUEE_AREA_PCT) {
          useStudioStore.getState().marqueeSelectBox(box, {
            additive: e.nativeEvent.shiftKey,
          });
        } else if (!e.nativeEvent.shiftKey) {
          useStudioStore.getState().clearSelection();
        }
        return; // a marquee gesture never fires a ground click
      }
      if (dragState.current.active && !dragState.current.moved && onGroundClick) {
        const world = raycastGround(e, groundRef);
        // A click (pointer-up that never became a drag) fires selection even
        // under the 3D/tilted blend. Selection is a click, not a camera
        // gesture, and pan is already captured at pointer-down (beginPanDrag),
        // so allowing the click here does not disturb the pan law — it is what
        // lets an operator pick a placed asset and transform it in the 3D
        // Garden view. (The old `!tiltLocked` gate was a carryover of the
        // retired SVG `isTiltActive` rule.)
        if (world) {
          onGroundClick(worldToPct(world[0], world[1], scaleM, boardAspect), {
            additive: e.nativeEvent.shiftKey,
          });
        }
      }
      dragState.current.active = false;
      dragState.current.isPan = false;
    },
    [onGroundClick, scaleM, boardAspect],
  );

  const groundSize = scaleM * 5;

  // A pinned photo-trace session owns pointer capture: at the facade the
  // camera origin sits exactly on this ground plane, so every ray hits it at
  // t=0 and R3F routes the event here (nearest hit) instead of to the photo
  // plane. Park the capture plane far below ground while pinned — the photo
  // plane's own handlers take over; wheel zoom is intentionally inert until
  // the pin releases (the pin rig already frames the plane).
  const photoTraceSession = useStudioStore((s) => s.photoTraceSession);
  const capturePlaneY = photoTraceSession ? -1000 : 0;

  return (
    <>
      {/*
       * Invisible ground plane — captures all pointer events for the scene.
       * Sized larger than the lot so panning beyond the boundary still raycasts.
       */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, capturePlaneY, 0]}
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

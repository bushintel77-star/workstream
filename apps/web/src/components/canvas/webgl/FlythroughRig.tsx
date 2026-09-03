"use client";

/**
 * Spatial Sketching — Cinematic Fly-Through Rig (Phase 5).
 *
 * Plays back a smooth, spline-based fly-through presentation using saved
 * camera bookmarks. Constructs two THREE.CatmullRomCurve3 splines (one for
 * camera position, one for look-at target) and samples them in the useFrame
 * loop to directly drive the camera.
 *
 * Key design decisions:
 *   - No third-party animation library. Uses native Three.js CatmullRomCurve3
 *     + the existing useFrame loop.
 *   - Respects the existing FusedCamera rig. When isPlayingFlythrough is true,
 *     this component overrides the camera AFTER FusedCamera runs (it mounts
 *     later in the scene graph, so its useFrame runs later). When playback
 *     finishes, FusedCamera resumes full control from the liveRig state.
 *   - Gestures are paused during playback — StudioControls gates on
 *     isPlayingFlythrough from the store.
 *   - The FusedCamera's useFrame also writes _liveCameraPosition to the store
 *     each frame (for bookmark capture), and self-gates on isPlayingFlythrough
 *     so it doesn't fight the fly-through.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";

export function FlythroughRig() {
  const { camera } = useThree();
  const isPlayingFlythrough = useStudioStore((s) => s.isPlayingFlythrough);
  const cameraBookmarks = useStudioStore((s) => s.cameraBookmarks);
  const toggleFlythrough = useStudioStore((s) => s.toggleFlythrough);
  const walkLingerS = useStudioStore((s) => s.walkLingerS);
  const walkTransitionS = useStudioStore((s) => s.walkTransitionS);
  const walkLoop = useStudioStore((s) => s.walkLoop);
  const setWalkProgress = useStudioStore((s) => s.setWalkProgress);

  // Phase J — visibility keyframing. Read viewpointVisibility and
  // sketchCanvases to compute which canvases to hide during playback.
  // The savedHiddenIds ref preserves the operator's pre-playback hidden
  // set so it can be restored when the walk stops.
  const sketchCanvases = useStudioStore((s) => s.sketchCanvases);
  const savedHiddenIdsRef = useRef<string[] | null>(null);
  const lastViewpointIdxRef = useRef<number>(-1);

  // Animation progress (0.0 to 1.0) — accumulates via delta time.
  const progressRef = useRef(0);
  // Linger accumulator — counts down during a pause at a viewpoint.
  const lingerRef = useRef(0);

  // Build the splines from the bookmarks. CatmullRomCurve3 produces a smooth
  // curve that passes through all control points — ideal for camera paths.
  const { positionCurve, targetCurve } = useMemo(() => {
    if (cameraBookmarks.length < 2) {
      return { positionCurve: null, targetCurve: null };
    }
    const positions = cameraBookmarks.map(
      (b) => new THREE.Vector3(b.position[0], b.position[1], b.position[2]),
    );
    const targets = cameraBookmarks.map(
      (b) => new THREE.Vector3(b.target[0], b.target[1], b.target[2]),
    );
    return {
      positionCurve: new THREE.CatmullRomCurve3(positions, true),
      targetCurve: new THREE.CatmullRomCurve3(targets, true),
    };
  }, [cameraBookmarks]);

  // Pre-allocated scratch vectors (zero allocation in the hot loop).
  const scratchPos = useMemo(() => new THREE.Vector3(), []);
  const scratchTarget = useMemo(() => new THREE.Vector3(), []);

  // Total sequence duration: N viewpoints × (transition + linger).
  // The spline covers N segments; each segment takes transitionS + lingerS.
  const segmentCount = Math.max(1, cameraBookmarks.length);
  const totalDurationS = segmentCount * (walkTransitionS + walkLingerS);

  // Phase J — when playback stops (either by reaching the end or by the
  // operator pausing), restore the saved hidden canvas set. This effect
  // catches the external pause case (the end-of-playback case is handled
  // inline in useFrame above).
  useEffect(() => {
    if (!isPlayingFlythrough && savedHiddenIdsRef.current !== null) {
      useStudioStore.setState({ hiddenCanvasIds: savedHiddenIdsRef.current });
      savedHiddenIdsRef.current = null;
      lastViewpointIdxRef.current = -1;
    }
  }, [isPlayingFlythrough]);

  useFrame((_, delta) => {
    if (!isPlayingFlythrough || !positionCurve || !targetCurve) return;

    // Phase J — on the first frame of playback, save the operator's
    // current hidden canvas set so it can be restored when the walk ends.
    if (savedHiddenIdsRef.current === null) {
      savedHiddenIdsRef.current = [...useStudioStore.getState().hiddenCanvasIds];
    }

    // Phase J — compute the active viewpoint index and apply visibility
    // keyframes. The active viewpoint is the knot closest to the current
    // progress head. When a viewpoint has a keyframe entry in
    // viewpointVisibility, hide all canvases NOT listed. When it doesn't,
    // restore the operator's saved hidden set (no keyframe = no override).
    const state = useStudioStore.getState();
    const viewpointVisibility = state.viewpointVisibility;
    const hasAnyKeyframes = Object.keys(viewpointVisibility).length > 0;
    if (hasAnyKeyframes && cameraBookmarks.length > 0) {
      const idx = Math.min(
        cameraBookmarks.length - 1,
        Math.floor(progressRef.current * cameraBookmarks.length),
      );
      if (idx !== lastViewpointIdxRef.current) {
        lastViewpointIdxRef.current = idx;
        const vpId = cameraBookmarks[idx]!.id;
        const visibleList = viewpointVisibility[vpId];
        if (visibleList !== undefined) {
          // Keyframe exists — hide canvases not in the visible list.
          const hiddenIds = sketchCanvases
            .filter((c) => !visibleList.includes(c.id))
            .map((c) => c.id);
          useStudioStore.setState({ hiddenCanvasIds: hiddenIds });
        } else {
          // No keyframe for this viewpoint — restore the saved set.
          useStudioStore.setState({
            hiddenCanvasIds: savedHiddenIdsRef.current ?? [],
          });
        }
      }
    }

    // Check if we're lingering at a viewpoint (progress is near a knot).
    if (lingerRef.current > 0) {
      lingerRef.current -= delta;
      if (lingerRef.current <= 0) {
        lingerRef.current = 0;
      } else {
        // Hold the camera at the current knot — don't advance progress.
        return;
      }
    }

    // Advance the animation progress. Each segment takes transitionS.
    const transitionDelta = delta / totalDurationS;
    progressRef.current += transitionDelta;

    // Check if we've reached the next knot — if so, start lingering.
    const segmentT = 1 / segmentCount;
    const posInSegment = progressRef.current % segmentT;
    if (posInSegment < transitionDelta && walkLingerS > 0) {
      // Just crossed a knot — start the linger pause.
      lingerRef.current = walkLingerS;
    }

    if (progressRef.current >= 1.0) {
      if (walkLoop) {
        progressRef.current = 0;
        if (walkLingerS > 0) lingerRef.current = walkLingerS;
      } else {
        progressRef.current = 0;
        setWalkProgress(0);
        // Phase J — restore the operator's pre-playback hidden canvas set.
        if (savedHiddenIdsRef.current !== null) {
          useStudioStore.setState({ hiddenCanvasIds: savedHiddenIdsRef.current });
          savedHiddenIdsRef.current = null;
        }
        lastViewpointIdxRef.current = -1;
        toggleFlythrough();
        return;
      }
    }

    // Publish progress for the filmstrip progress bar.
    setWalkProgress(progressRef.current);

    // Sample the splines at the current progress.
    const t = progressRef.current;
    positionCurve.getPointAt(t, scratchPos);
    targetCurve.getPointAt(t, scratchTarget);

    // Directly set the camera position + look-at. This overrides whatever
    // FusedCamera wrote earlier in the frame (FusedCamera self-gates on
    // isPlayingFlythrough, so it didn't write this frame).
    camera.position.copy(scratchPos);
    camera.lookAt(scratchTarget);
    camera.updateMatrixWorld(true);
  });

  return null;
}

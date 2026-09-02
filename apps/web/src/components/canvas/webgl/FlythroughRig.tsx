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

import { useMemo, useRef } from "react";
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

  useFrame((_, delta) => {
    if (!isPlayingFlythrough || !positionCurve || !targetCurve) return;

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

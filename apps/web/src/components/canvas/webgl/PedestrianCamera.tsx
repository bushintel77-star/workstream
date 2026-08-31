/**
 * Phase 8 — Pedestrian Camera (1.7m first-person walk-through).
 *
 * When `cameraPosture === 'PEDESTRIAN'`, this component takes over the camera
 * from FusedCamera (which skips its logic when pedestrian mode is active, the
 * same pattern as the fly-through rig).
 *
 * Features:
 *   - Camera locked to 1.7m above the ground plane (human eye level)
 *   - WASD / arrow keys translate the camera forward/backward + strafe
 *   - Pointer drag = mouselook (yaw + pitch), NOT orbit
 *   - Smooth damping on all axes (no snap)
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3 (camera layering)
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";

/** Human eye height in metres. */
const EYE_HEIGHT_M = 1.7;
/** Movement speed in metres per second. */
const MOVE_SPEED = 8;
/** Look sensitivity (radians per pixel of drag). */
const LOOK_SENSITIVITY = 0.004;
/** Damping factor for position smoothing (higher = snappier). */
const POS_DAMP = 8;
/** Damping factor for look smoothing. */
const LOOK_DAMP = 10;
/** Pitch clamp (don't let the user look fully up/down). */
const PITCH_CLAMP = Math.PI / 2 - 0.1;

export function PedestrianCamera({
  sampler,
}: {
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  const { camera, gl } = useThree();
  const cameraPosture = useStudioStore((s) => s.cameraPosture);

  // Persistent refs for the pedestrian camera state (survive re-renders).
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const targetPosRef = useRef(new THREE.Vector3(0, EYE_HEIGHT_M, 0));
  const keysRef = useRef<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const lastDragRef = useRef({ x: 0, y: 0 });

  // Initialise the target position to the world origin at eye height on first
  // activation.
  const initialisedRef = useRef(false);

  // --- Keyboard input (WASD + arrow keys) ---
  useEffect(() => {
    if (cameraPosture !== "PEDESTRIAN") {
      keysRef.current.clear();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
      ) {
        keysRef.current.add(key);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const keys = keysRef.current;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keys.clear();
    };
  }, [cameraPosture]);

  // --- Pointer mouselook (drag to look around) ---
  useEffect(() => {
    if (cameraPosture !== "PEDESTRIAN") {
      draggingRef.current = false;
      return;
    }

    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      draggingRef.current = true;
      lastDragRef.current = { x: e.clientX, y: e.clientY };
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastDragRef.current.x;
      const dy = e.clientY - lastDragRef.current.y;
      lastDragRef.current = { x: e.clientX, y: e.clientY };
      targetYawRef.current -= dx * LOOK_SENSITIVITY;
      targetPitchRef.current = Math.max(
        -PITCH_CLAMP,
        Math.min(PITCH_CLAMP, targetPitchRef.current - dy * LOOK_SENSITIVITY),
      );
    };
    const onPointerUp = () => {
      draggingRef.current = false;
      el.style.cursor = "grab";
    };

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.style.cursor = "";
    };
  }, [cameraPosture, gl]);

  // --- Per-frame update ---
  useFrame((_, delta) => {
    if (cameraPosture !== "PEDESTRIAN") {
      initialisedRef.current = false;
      return;
    }

    // On first activation, snap the camera to the current position at eye
    // height (smooth transition from orbit to pedestrian).
    if (!initialisedRef.current) {
      initialisedRef.current = true;
      targetPosRef.current.set(
        camera.position.x,
        EYE_HEIGHT_M,
        camera.position.z,
      );
      // Derive initial yaw/pitch from the camera's current look direction.
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      targetYawRef.current = Math.atan2(dir.x, dir.z);
      targetPitchRef.current = Math.asin(
        Math.max(-1, Math.min(1, dir.y)),
      );
      yawRef.current = targetYawRef.current;
      pitchRef.current = targetPitchRef.current;
    }

    // --- Movement (WASD / arrows) ---
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const move = new THREE.Vector3();

    // Forward direction from yaw only (ignore pitch for ground movement).
    forward.set(
      Math.sin(targetYawRef.current),
      0,
      Math.cos(targetYawRef.current),
    ).normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const keys = keysRef.current;
    if (keys.has("w") || keys.has("arrowup")) move.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) move.sub(forward);
    if (keys.has("d") || keys.has("arrowright")) move.add(right);
    if (keys.has("a") || keys.has("arrowleft")) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED * delta);
      targetPosRef.current.add(move);
    }

    // Clamp Y to eye height above the terrain (or 0 if no sampler).
    const groundY = sampler
      ? sampler(targetPosRef.current.x, targetPosRef.current.z)
      : 0;
    targetPosRef.current.y = groundY + EYE_HEIGHT_M;

    // --- Smooth damping ---
    const posDamp = 1 - Math.exp(-delta * POS_DAMP);
    camera.position.lerp(targetPosRef.current, posDamp);

    const lookDamp = 1 - Math.exp(-delta * LOOK_DAMP);
    yawRef.current = THREE.MathUtils.lerp(
      yawRef.current,
      targetYawRef.current,
      lookDamp,
    );
    pitchRef.current = THREE.MathUtils.lerp(
      pitchRef.current,
      targetPitchRef.current,
      lookDamp,
    );

    // --- Apply look direction ---
    const lookDir = new THREE.Vector3(
      Math.sin(yawRef.current) * Math.cos(pitchRef.current),
      -Math.sin(pitchRef.current),
      Math.cos(yawRef.current) * Math.cos(pitchRef.current),
    );
    camera.lookAt(
      camera.position.x + lookDir.x,
      camera.position.y + lookDir.y,
      camera.position.z + lookDir.z,
    );

    // Ensure the camera is in perspective mode (not ortho). The FusedCamera
    // may have left it in a fused projection state; force perspective.
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) {
      persp.aspect = window.innerWidth / window.innerHeight;
      persp.updateProjectionMatrix();
    }
  });

  return null;
}

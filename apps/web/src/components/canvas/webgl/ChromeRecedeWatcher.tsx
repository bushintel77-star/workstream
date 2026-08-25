"use client";

/**
 * Motion-aware chrome recede — AEC-2026 research adoption §3.2
 * (docs/AEC-2026-RESEARCH-ADOPTION.md).
 *
 * While the camera orbits/pans/zooms, the floating chrome drops opacity so
 * boundaries and canopies read beneath it; full opaque paper returns at
 * rest. Opacity ONLY — no blur, no refraction, no dark — and the resting
 * frost/blur that the 2026-08-25 LA release removed stays removed.
 *
 * Implementation law: the R3F loop writes the store ONLY on state flip
 * (never per-frame — the same discipline as FusedCamera's liveRig), and the
 * DOM class is toggled imperatively on <body> (MetaChipSet precedent), so
 * receding chrome never re-renders the React tree.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useStudioStore } from "./studioStore";
import { useReducedMotion } from "./useReducedMotion";

/** Camera delta (world units / quaternion dot) above which a frame "moves". */
export const RECEDE_EPSILON = 1e-4;
/** How long the recede holds after the last moving frame (ms). */
export const REST_LINGER_MS = 150;

/**
 * Pure state machine — exported for unit tests. `now`/`lastMoveAt` in ms.
 * Recede is true while moving OR within the rest-linger window after the
 * last moving frame.
 */
export function recedeState(
  moving: boolean,
  now: number,
  lastMoveAt: number,
): boolean {
  return moving || now - lastMoveAt < REST_LINGER_MS;
}

/**
 * Inside the R3F loop: compares the camera transform frame-to-frame and
 * flips `chromeReceded` in the studio store on state change only. Disabled
 * entirely under prefers-reduced-motion (the auto recede is motion chrome;
 * the hold-H peek remains available — it is user-initiated).
 */
export function ChromeRecedeWatcher() {
  const reducedMotion = useReducedMotion();
  const posRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const quatRef = useRef<{ x: number; y: number; z: number; w: number } | null>(null);
  const lastMoveAt = useRef(0);
  const receded = useRef(false);

  useFrame(({ camera }) => {
    if (reducedMotion) return;
    const now = performance.now();
    let moving = false;
    const p = posRef.current;
    const q = quatRef.current;
    if (p && q) {
      const dp = Math.hypot(
        camera.position.x - p.x,
        camera.position.y - p.y,
        camera.position.z - p.z,
      );
      // Quaternion dot written out — the plain-object ref is not a THREE.Quaternion.
      const dq = 1 - Math.abs(
        camera.quaternion.x * q.x +
          camera.quaternion.y * q.y +
          camera.quaternion.z * q.z +
          camera.quaternion.w * q.w,
      );
      moving = dp > RECEDE_EPSILON || dq > RECEDE_EPSILON;
    }
    if (moving) lastMoveAt.current = now;
    const should = recedeState(moving, now, lastMoveAt.current);
    if (should !== receded.current) {
      receded.current = should;
      useStudioStore.getState().setChromeReceded(should);
    }
    posRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    quatRef.current = {
      x: camera.quaternion.x,
      y: camera.quaternion.y,
      z: camera.quaternion.z,
      w: camera.quaternion.w,
    };
  });

  return null;
}

"use client";

/**
 * LiveNibProjector — R3F component that projects the live draw point
 * (`liveCoord` from the store) to screen-space coordinates every frame.
 *
 * Pure math component — renders no DOM. Writes screen coords to
 * `liveNibScreen` in the store. The `LiveNibReadout` DOM-overlay component
 * reads those coords and positions itself via `translate3d` on a ref.
 *
 * This is the same pattern as `ConflictCardProjector` and `MetaChipSet`:
 * the projection runs in the render loop (jitter-free), the DOM mutation
 * is a compositor-only `translate3d` (thrash-free).
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";

export function LiveNibProjector() {
  const scratch = useRef(new THREE.Vector3());
  const setLiveNibScreen = useStudioStore((s) => s.setLiveNibScreen);

  useFrame(({ camera, size }) => {
    const { liveCoord, penDown } = useStudioStore.getState();
    if (!penDown || !liveCoord) {
      setLiveNibScreen(null);
      return;
    }
    // Project the live draw point [x, 0, z] → NDC → screen pixels.
    // Y is at ground level (FLAT_Y ≈ 0) — the readout tracks the plan position.
    const ndc = scratch.current
      .set(liveCoord.x, 0, liveCoord.z)
      .project(camera);
    const behind = ndc.z > 1;
    const x = ((ndc.x + 1) * size.width) / 2;
    const y = ((1 - ndc.y) * size.height) / 2;
    setLiveNibScreen({ x, y, behind });
  });

  return null;
}

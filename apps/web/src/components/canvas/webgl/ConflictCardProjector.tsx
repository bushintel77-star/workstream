"use client";

/**
 * ConflictCardProjector — R3F component that projects the active conflict
 * strike point to screen-space coordinates every frame.
 *
 * This component lives inside the R3F <Canvas> (it needs `useFrame` + camera
 * access) but writes only screen coords to the store — it renders no DOM.
 * The ConflictCard in the DOM overlay reads those coords and positions itself.
 *
 * This satisfies the chrome parenting rule: no DOM chrome inside the canvas.
 * The projector is a pure math component; the card is pure DOM overlay.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";
import type { StrikeAlertData } from "./features/SubsurfaceEngine";

export interface ConflictCardProjectorProps {
  /** Active strike alerts — the projector picks the selected index. */
  strikes: StrikeAlertData[];
}

export function ConflictCardProjector({ strikes }: ConflictCardProjectorProps) {
  const scratch = useRef(new THREE.Vector3());
  const strikeIdx = useStudioStore((s) => s.conflictCardStrikeIdx);
  const setScreen = useStudioStore((s) => s.setConflictCardScreen);

  useFrame(({ camera, size }) => {
    if (strikeIdx == null || strikes.length === 0) {
      setScreen(null);
      return;
    }
    const strike = strikes[Math.min(strikeIdx, strikes.length - 1)];
    if (!strike) {
      setScreen(null);
      return;
    }
    // Project the clash point [x, y, z] → NDC → screen pixels
    const ndc = scratch.current
      .set(strike.point[0], strike.point[1], strike.point[2])
      .project(camera);
    const behind = ndc.z > 1;
    const x = ((ndc.x + 1) * size.width) / 2;
    const y = ((1 - ndc.y) * size.height) / 2;
    setScreen({ x, y, behind });
  });

  return null;
}

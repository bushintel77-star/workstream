"use client";

/**
 * CameraProbe — publishes the live camera's projection facts to the store.
 *
 * Pure math component, renders no DOM. Writes `cameraView` ONLY when the
 * facts change (no per-frame store churn): the ortho frustum's visible
 * width in world metres, or kind "persp" when the active projection has no
 * scale. The PDF export reads this at capture time to compute a viewport's
 * TRUE printed scale (frustum metres ÷ frame metres) instead of trusting
 * nominal scale metadata.
 *
 * Note on the fused camera: FusedCamera lerps between ortho and persp
 * projections while a preset transition springs. The probe reports the
 * camera's settled classification (isOrthographicCamera + frustum), which
 * is exactly what a rested post-settle capture needs.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";

export function CameraProbe() {
  const setCameraView = useStudioStore((s) => s.setCameraView);
  const lastKey = useRef("");

  useFrame(({ camera }) => {
    const ortho = camera as THREE.OrthographicCamera;
    const view = ortho.isOrthographicCamera
      ? {
          kind: "ortho" as const,
          widthM: Math.abs(ortho.right - ortho.left),
        }
      : { kind: "persp" as const, widthM: 0 };
    const key = `${view.kind}:${view.widthM.toFixed(4)}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setCameraView(view);
    }
  });

  return null;
}

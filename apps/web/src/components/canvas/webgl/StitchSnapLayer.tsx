"use client";

/**
 * Gold Standard 2026 — Stitch Snap Layer (pulsing ε-snap vertex dots).
 *
 * Renders subtle pulsing vertex dots at welded stroke nodes whenever the
 * live drawing cursor (or an unwarped photo stroke endpoint) falls within
 * the stitcher's ε-snap radius (default 0.15 m, the same tolerance
 * `stitchCanvasStrokes` welds with — what you see is what welds).
 *
 * Reads the store's `stitchSnapNodes` (world metres) + `stitchHoverPoint`;
 * the drawing surfaces (FusedSketchLayer / PhotoTracePlane) push both while
 * their pointer capture is live. Self-gates on sketch mode + proximity, so
 * the dots only appear exactly where a weld is about to happen.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { findSnapCandidates, type SpatialPoint } from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { SPATIAL_LAYER } from "./layerContract";
import { useStudioStore } from "./studioStore";

/** Marker-tier clearance — the dots read above ink and ground linework. */
const SNAP_DOT_Y = SPATIAL_LAYER.markers.offsetM + 0.02;

export function StitchSnapLayer() {
  const snapNodes = useStudioStore((s) => s.stitchSnapNodes);
  const hoverPoint = useStudioStore((s) => s.stitchHoverPoint);
  const epsilonM = useStudioStore((s) => s.stitchEpsilonM);
  const sketchMode = useStudioStore((s) => s.sketchMode);

  const candidates = useMemo(
    () =>
      hoverPoint && snapNodes.length > 0
        ? findSnapCandidates(hoverPoint, snapNodes, epsilonM)
        : [],
    [hoverPoint, snapNodes, epsilonM],
  );

  // Draw-time indicator only — nothing to show when the ink tool is idle.
  if (!sketchMode || candidates.length === 0) return null;
  return (
    <group>
      {candidates.map((c, i) => (
        <PulsingSnapDot
          key={`${c.point.x.toFixed(4)}:${c.point.y.toFixed(4)}`}
          point={c.point}
          phase={i * 1.7}
        />
      ))}
    </group>
  );
}

/** A slow-pulsing dot at a weld node (phase offset keeps multi-dot beats apart). */
function PulsingSnapDot({ point, phase }: { point: SpatialPoint; phase: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4.5 + phase);
    if (meshRef.current) meshRef.current.scale.setScalar(0.85 + 0.5 * pulse);
    if (matRef.current) matRef.current.opacity = 0.35 + 0.55 * pulse;
  });

  return (
    <group position={[point.x, SNAP_DOT_Y, point.y]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.11, 20]} />
        <meshBasicMaterial
          ref={matRef}
          color={PALETTE.gsPrimary}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

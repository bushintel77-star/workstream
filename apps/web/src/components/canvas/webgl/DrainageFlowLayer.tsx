"use client";

/**
 * Gold Standard 2026 — Drainage Flow Layer (overland water on the terrain).
 *
 * Derives where rain goes from the SHARED terrainMath sampler (D8 flow
 * routing — see flowField.ts) and renders it on the visible surface:
 *
 *   - Streams: dashed hairlines in the muted drafting water colour, creeping
 *     dashOffset (the SubsurfaceEngine / Stitch "hydrological pulse" idiom)
 *     so the eye reads downhill direction without motion noise.
 *   - Ponding points: flat translucent water discs breathing at the pits —
 *     the actionable insight (where a design needs drainage attention).
 *
 * Everything static is derived once in useMemo (the flow grid is per-terrain,
 * not per-frame). ONE useFrame animates all dash offsets + pond opacities via
 * pre-collected refs — zero allocations, zero re-renders.
 *
 * Self-gating: subscribes drainageView from the store and returns null when
 * off (drops from the render loop entirely) or when the project has no
 * terrain (sampler null — flat sites are silently inert).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import { useMemo, useRef, type ElementRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import {
  buildStudioFlowGrid,
  traceStreamNetwork,
  findPondingPoints,
  MAX_POND_MARKERS,
} from "./flowField";

/** Dash creep speed (dashOffset units / second) — water, slightly livelier
 *  than buried conduits (0.08) but calmer than electric/data (0.15). */
const FLOW_SPEED = 0.12;
/** Y offsets above the surface (streams above the ink's 0.02 / slice 0.03). */
const STREAM_Y_OFFSET = 0.05;
const POND_Y_OFFSET = 0.06;
/** Accumulation fraction above which a stream reads as a main channel. */
const MAIN_CHANNEL_FRACTION = 0.05;

/** Pond disc radius from catchment (clamped so tiny pools stay visible). */
function pondRadiusM(catchmentM2: number): number {
  return THREE.MathUtils.clamp(Math.sqrt(catchmentM2) * 0.06, 1.2, 4);
}

export interface DrainageFlowLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — the flow is derived from the same surface as the mesh. */
  heightmapPoints: HeightmapPoint[];
}

export function DrainageFlowLayer({
  scaleM,
  boardAspect,
  heightmapPoints,
}: DrainageFlowLayerProps) {
  const drainageView = useStudioStore((s) => s.drainageView);
  // Chrome contract 6.8: overland flow is meaningless on a section cut.
  const cameraPreset = useStudioStore((s) => s.cameraPreset);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  // Static analysis — recomputed only when the terrain itself changes.
  const flow = useMemo(() => {
    if (!sampler) return null;
    const grid = buildStudioFlowGrid(sampler, scaleM, boardAspect);
    return {
      grid,
      streams: traceStreamNetwork(grid),
      ponds: findPondingPoints(grid).slice(0, MAX_POND_MARKERS),
    };
  }, [sampler, scaleM, boardAspect]);

  // Refs collected once per mount for the single animation loop.
  const streamRefs = useRef<Array<ElementRef<typeof Line> | null>>([]);
  const pondMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  useFrame((state, delta) => {
    for (const line of streamRefs.current) {
      if (line) line.material.dashOffset -= delta * FLOW_SPEED;
    }
    const t = state.clock.elapsedTime;
    for (let i = 0; i < pondMatRefs.current.length; i++) {
      const mat = pondMatRefs.current[i];
      if (mat) mat.opacity = 0.34 + 0.12 * Math.sin(t * 1.6 + i * 0.9);
    }
  });

  if (!drainageView || cameraPreset === "sec" || !flow) return null;

  const { grid, streams, ponds } = flow;
  const totalCells = grid.cols * grid.rows;
  const mainChannelAccum = MAIN_CHANNEL_FRACTION * totalCells;

  return (
    <group>
      {/* Stream network — dashed hairlines draped on the surface. */}
      {streams.map((s, i) => {
        const points = s.points.map(
          ([x, y, z]) => [x, y + STREAM_Y_OFFSET, z] as [number, number, number],
        );
        return (
          <Line
            key={i}
            ref={(el) => {
              streamRefs.current[i] = el;
            }}
            points={points}
            color={PALETTE.cadWater}
            lineWidth={s.maxAccum > mainChannelAccum ? 3 : 2}
            dashed
            dashSize={0.8}
            gapSize={0.6}
            transparent
            opacity={0.85}
          />
        );
      })}

      {/* Ponding markers — flat water discs at the pits. */}
      {ponds.map((p, i) => (
        <mesh
          key={`pond-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.x, p.elevY + POND_Y_OFFSET, p.z]}
        >
          <circleGeometry args={[pondRadiusM(p.catchmentM2), 24]} />
          <meshBasicMaterial
            ref={(el) => {
              pondMatRefs.current[i] = el;
            }}
            color={PALETTE.cadWater}
            transparent
            opacity={0.36}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

"use client";

/**
 * Gold Standard 2026 — Elevation Slice Line (Vertical Truth instrument).
 *
 * A draggable axis-aligned cutting line that lies on the terrain surface. As
 * the operator drags it, the SliceProfileCard (DOM) redraws a live 2D elevation
 * profile along the cut — the "section view" of the topography.
 *
 * The line samples the SHARED terrainMath sampler, so it sits exactly on the
 * TerrainMesh surface (and matches the stroke drape) — the slice is truthful,
 * not an approximation.
 *
 * Dragging: an invisible wider plane along the cut captures pointer drag and
 * updates slicePosM via raycast. Suppressed when sketchMode is on (the
 * FusedSketchLayer owns pointer events then). Only mounts when terrain exists.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth)
 */

import { useMemo, useRef } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";

/** Signal Blue — the section-cut identity (matches the lot boundary line). */
const SLICE_BLUE = "#0030CF";

/** Number of sample points along the cut line (resolution of the draped line). */
const CUT_SAMPLES = 64;
/** Y offset above the terrain surface (avoids z-fighting with the mesh). */
const SURFACE_OFFSET = 0.03;

export interface ElevationSliceLineProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — the line drapes over the same terrain as the mesh. */
  heightmapPoints: HeightmapPoint[];
}

export function ElevationSliceLine({
  scaleM,
  boardAspect,
  heightmapPoints,
}: ElevationSliceLineProps) {
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const sliceAxis = useStudioStore((s) => s.sliceAxis);
  const slicePosM = useStudioStore((s) => s.slicePosM);
  const setSlicePosM = useStudioStore((s) => s.setSlicePosM);
  const sketchMode = useStudioStore((s) => s.sketchMode);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  // Lot bounds (lot is centred on world origin).
  const halfX = scaleM / 2;
  const halfZ = (scaleM * boardAspect) / 2;

  // Build the cut line points — sampled along the cut axis at slicePosM.
  // axis "z" → line runs along X at Z=slicePosM (E/W cut).
  // axis "x" → line runs along Z at X=slicePosM (N/S cut).
  const linePoints = useMemo<[number, number, number][]>(() => {
    if (!sampler) return [];
    const pts: [number, number, number][] = [];
    for (let i = 0; i < CUT_SAMPLES; i++) {
      const t = i / (CUT_SAMPLES - 1);
      let x: number, z: number;
      if (sliceAxis === "z") {
        x = -halfX + t * scaleM;
        z = slicePosM;
      } else {
        x = slicePosM;
        z = -halfZ + t * scaleM * boardAspect;
      }
      const y = (sampler(x, z) ?? 0) + SURFACE_OFFSET;
      pts.push([x, y, z]);
    }
    return pts;
  }, [sampler, sliceAxis, slicePosM, scaleM, boardAspect, halfX, halfZ]);

  // Drag plane — an invisible wider plane along the cut that captures drag.
  // Sized to the cut length × a comfortable grab thickness.
  const dragPlaneLen = sliceAxis === "z" ? scaleM : scaleM * boardAspect;
  const dragPlaneThick = 1.2; // metres of grab width

  // Track whether the pointer is actively dragging the handle (button held).
  // R3F fires onPointerMove on hover too; we only want to move the line while dragging.
  const draggingRef = useRef(false);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (sketchMode) return;
    e.stopPropagation();
    draggingRef.current = true;
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (sketchMode || !draggingRef.current) return;
    e.stopPropagation();
    const p = e.point;
    if (!p) return;
    // Update the cross-axis position from the pointer's coordinate.
    const clamped = sliceAxis === "z"
      ? THREE.MathUtils.clamp(p.z, -halfZ, halfZ)
      : THREE.MathUtils.clamp(p.x, -halfX, halfX);
    setSlicePosM(clamped);
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    draggingRef.current = false;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  if (!sliceActive || !sampler) return null;

  return (
    <group>
      {/* The visible cut line — Signal Blue, drapes on the terrain */}
      {linePoints.length >= 2 && (
        <Line
          points={linePoints}
          color={SLICE_BLUE}
          lineWidth={3}
          transparent
          opacity={0.95}
        />
      )}

      {/* Drag handle — invisible wider plane along the cut */}
      <mesh
        rotation={sliceAxis === "z" ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI / 2]}
        position={sliceAxis === "z" ? [0, SURFACE_OFFSET, slicePosM] : [slicePosM, SURFACE_OFFSET, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[dragPlaneLen, dragPlaneThick]} />
        <meshBasicMaterial
          color={SLICE_BLUE}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

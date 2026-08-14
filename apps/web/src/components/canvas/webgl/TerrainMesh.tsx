/**
 * Gold Standard 2026 — Terrain Mesh (heightmap from spot levels).
 *
 * Builds a real topographic surface from site_frame.levels using inverse-distance
 * weighting (IDW). When levels exist, the ground plane becomes a displaced mesh
 * with real relief — which the terrain instruments consume:
 *   - True 3D drape for sketch strokes (ink follows topography)
 *   - Cut/fill earthworks against extruded sketch pads (EarthworksLayer/cutFill.ts)
 *   - Drainage overland flow — D8 streams + ponding (DrainageFlowLayer/flowField.ts)
 *
 * When NO levels exist, the mesh is perfectly flat at y=0 (degenerates to the
 * current flat ground — zero visual change for projects without survey data).
 *
 * The IDW math + normalization live in terrainMath.ts and are SHARED with
 * FusedSketchLayer (stroke drape) and ElevationSliceLine so all three sample
 * identical terrain — the ink and slice always sit on the surface.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (terrain heightmap)
 */

import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import type { HeightmapPoint } from "./coordTransform";
import {
  GRID_SEGMENTS,
  SEARCH_RADIUS_FACTOR,
  idwElevation,
  normalizeLevels,
} from "./terrainMath";

export interface TerrainMeshProps {
  scaleM: number;
  boardAspect: number;
  /** Spot level sample points in world space [{x, z, y}]. */
  heightmapPoints: HeightmapPoint[];
}

export function TerrainMesh({ scaleM, boardAspect, heightmapPoints }: TerrainMeshProps) {
  const w = scaleM * 3;
  const h = scaleM * boardAspect * 3;

  // Normalize the spot levels to a local datum.
  const normalizedSamples = useMemo(
    () => normalizeLevels(heightmapPoints),
    [heightmapPoints],
  );

  // Build the displaced geometry.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(w, h, GRID_SEGMENTS, GRID_SEGMENTS);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    // Search radius matches the drape + slice samplers (terrainMath.ts).
    const searchRadius = Math.max(scaleM, scaleM * boardAspect) * SEARCH_RADIUS_FACTOR;

    // PlaneGeometry is in the XY plane — we need to displace Z (which becomes
    // Y after the mesh is rotated -90° around X to lie flat). The rotation
    // maps local +Y → world −Z, so the world-space sample for a local vertex
    // (vx, vy) is (vx, −vy). Sampling at +vy would mirror the relief N/S
    // relative to the drape/slice samplers (which query world z directly).
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const elev = idwElevation(vx, -vy, normalizedSamples, searchRadius);
      pos.setZ(i, elev);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [w, h, normalizedSamples, scaleM, boardAspect]);

  // If no levels, don't render (the flat GroundPlane handles the no-data case).
  if (normalizedSamples.length === 0) return null;

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial
        color={PALETTE.groundOlive}
        roughness={0.92}
        metalness={0.02}
        flatShading={false}
      />
    </mesh>
  );
}

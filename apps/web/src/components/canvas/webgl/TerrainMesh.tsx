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
 * When NO levels exist, this mesh is not rendered at all — the flat
 * GroundPlane owns the ground (spatial-layer contract: exactly ONE ground
 * surface, never two fighting in the depth buffer).
 *
 * The surface material is contoured (terrainMaterial.ts): contour banding at
 * the surveyor's interval + slope-based albedo + noise breakup, on top of the
 * standard PBR base so sun/shadows/AO keep applying.
 *
 * The IDW math + normalization live in terrainMath.ts and are SHARED with
 * FusedSketchLayer (stroke drape), ElevationSliceLine, the semantic line
 * draping, and the aerial underlay — everything samples identical terrain.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (terrain heightmap)
 */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import type { HeightmapPoint } from "./coordTransform";
import {
  GRID_SEGMENTS,
  GROUND_CONTEXT_EXTENT,
  createElevationSampler,
} from "./terrainMath";
import { createTerrainMaterial } from "./terrainMaterial";
import { SPATIAL_LAYER } from "./layerContract";
import { useSeasonalStore } from "./seasonalStore";

export interface TerrainMeshProps {
  scaleM: number;
  boardAspect: number;
  /** Spot level sample points in world space [{x, z, y}]. */
  heightmapPoints: HeightmapPoint[];
  /** CAD mode: the surface lerps to the neutral drafting grey. */
  /** Resting ground albedo per the mode's layer policy. */
  groundAlbedo?: "paper" | "site";
}

/**
 * Build the displaced terrain geometry from the shared elevation sampler.
 * Exported so the aerial underlay drapes over the IDENTICAL surface (UVs are
 * PlaneGeometry's own — a texture map still lines up).
 */
export function buildTerrainGeometry(
  scaleM: number,
  boardAspect: number,
  heightmapPoints: HeightmapPoint[],
): THREE.BufferGeometry | null {
  if (heightmapPoints.length === 0) return null;
  const w = scaleM * GROUND_CONTEXT_EXTENT;
  const h = scaleM * boardAspect * GROUND_CONTEXT_EXTENT;
  const sampler = createElevationSampler(heightmapPoints, scaleM, boardAspect);
  if (!sampler) return null;

  const geo = new THREE.PlaneGeometry(w, h, GRID_SEGMENTS, GRID_SEGMENTS);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // PlaneGeometry lies in the XY plane; local Z is displaced (becomes world
  // +Y after the mesh's -90° X rotation). The sampler queries world space
  // directly, so sample at (vx, -vy) — the rotation maps local +Y → world −Z
  // and mirroring would flip relief N/S relative to the drape consumers.
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    pos.setZ(i, sampler(vx, -vy));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function TerrainMesh({ scaleM, boardAspect, heightmapPoints, groundAlbedo = "site" }: TerrainMeshProps) {
  const geometry = useMemo(
    () => buildTerrainGeometry(scaleM, boardAspect, heightmapPoints),
    [scaleM, boardAspect, heightmapPoints],
  );

  const restHex =
    groundAlbedo === "paper" ? PALETTE.gsCanvas : PALETTE.groundOlive;
  const drafting = groundAlbedo === "paper";
  const material = useMemo(
    () => createTerrainMaterial(restHex, drafting),
    [restHex, drafting],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Subsurface blueprint lerp — same behaviour the flat GroundPlane had:
  // the whole surface lightens toward vellum + drops roughness so the CAD
  // lines read through. Contour banding + slope albedo still carry the relief
  // on the paper albedo (terrainMaterial.ts), so plan view reads as a survey
  // drawing rather than a lit site surface.
  const colorRest = useMemo(() => new THREE.Color(restHex), [restHex]);
  const colorVellum = useMemo(
    () => new THREE.Color(PALETTE.renderBlueprintGround),
    [],
  );
  useFrame((_, delta) => {
    // The material is re-created when the mode's resting albedo changes, so
    // read it from the closure — a ref captured at first render would go stale.
    const mat = material;
    const { subsurfaceView } = useSeasonalStore.getState();
    const k = Math.min(1, delta * 4);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, subsurfaceView ? 0.88 : 1.0, k);
    mat.roughness = THREE.MathUtils.lerp(mat.roughness, subsurfaceView ? 0.6 : 0.92, k);
    // Mode surface law: subsurface vellum > the mode's resting albedo.
    mat.color.lerp(subsurfaceView ? colorVellum : colorRest, k);
  });

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      castShadow
      renderOrder={SPATIAL_LAYER.terrain.renderOrder}
    />
  );
}

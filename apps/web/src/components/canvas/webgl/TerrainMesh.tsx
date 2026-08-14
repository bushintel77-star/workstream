/**
 * Gold Standard 2026 — Terrain Mesh (heightmap from spot levels).
 *
 * Builds a real topographic surface from site_frame.levels using inverse-distance
 * weighting (IDW). When levels exist, the ground plane becomes a displaced mesh
 * with real relief — unlocking:
 *   - True 3D drape for sketch strokes (ink follows topography)
 *   - Cut/fill volume visualization potential
 *   - Drainage flow direction (water flows down gradients)
 *
 * When NO levels exist, the mesh is perfectly flat at y=0 (degenerates to the
 * current flat ground — zero visual change for projects without survey data).
 *
 * The height displacement is exaggerated by a vertical scale factor so subtle
 * grade changes (typically 0.5–2m over a residential lot) are visible in the
 * render without making the scene unrecognizable.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (terrain heightmap)
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";

/** Grid resolution — vertices per axis across the lot extent. */
const GRID_SEGMENTS = 60;
/** Vertical exaggeration — makes subtle grade changes visible. */
const VERTICAL_SCALE = 3.0;
/** IDW power parameter — how sharply influence falls off with distance. */
const IDW_POWER = 2.5;
/** IDW search radius in metres (relative to lot scale). */
const SEARCH_RADIUS_FACTOR = 0.6;

export interface TerrainMeshProps {
  scaleM: number;
  boardAspect: number;
  /** Spot level sample points in world space [{x, z, y}]. */
  heightmapPoints: Array<{ x: number; z: number; y: number }>;
}

/**
 * IDW interpolation — estimate the elevation at a query point from nearby
 * sample points. Returns 0 (flat) when no samples are within range.
 */
function idwElevation(
  queryX: number,
  queryZ: number,
  samples: Array<{ x: number; z: number; y: number }>,
  searchRadius: number,
): number {
  if (samples.length === 0) return 0;

  let weightSum = 0;
  let elevSum = 0;
  let foundAny = false;

  for (const s of samples) {
    const dx = s.x - queryX;
    const dz = s.z - queryZ;
    const dist = Math.hypot(dx, dz);
    if (dist > searchRadius) continue;
    foundAny = true;
    if (dist === 0) return s.y; // exact sample point
    const w = 1 / Math.pow(dist, IDW_POWER);
    weightSum += w;
    elevSum += w * s.y;
  }

  if (!foundAny || weightSum === 0) return 0;
  return elevSum / weightSum;
}

/**
 * Normalize spot levels to a local datum — subtract the mean elevation so the
 * terrain is centred on y=0. This prevents the whole mesh from floating at
 * AHD ~50m+ (Melbourne elevations) while preserving relative relief.
 */
function normalizeLevels(
  samples: Array<{ x: number; z: number; y: number }>,
): Array<{ x: number; z: number; y: number }> {
  if (samples.length === 0) return [];
  const meanY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
  return samples.map((s) => ({ ...s, y: (s.y - meanY) * VERTICAL_SCALE }));
}

export function TerrainMesh({ scaleM, boardAspect, heightmapPoints }: TerrainMeshProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

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

    const searchRadius = Math.max(scaleM, scaleM * boardAspect) * SEARCH_RADIUS_FACTOR;

    // PlaneGeometry is in the XY plane — we need to displace Z (which becomes
    // Y after the mesh is rotated -90° around X to lie flat).
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const elev = idwElevation(vx, vy, normalizedSamples, searchRadius);
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
        ref={matRef}
        color={PALETTE.groundOlive}
        roughness={0.92}
        metalness={0.02}
        flatShading={false}
      />
    </mesh>
  );
}

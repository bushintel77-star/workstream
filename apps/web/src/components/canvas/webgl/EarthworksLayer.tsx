"use client";

/**
 * Gold Standard 2026 — Earthworks Layer (cut/fill against sketch pads).
 *
 * Renders the earthworks analysis from cutFill.ts on the terrain:
 *
 *   - Committed pad masses: every closed stroke carrying extrude_height_m
 *     extrudes into a semi-transparent mass — until now committed extrusions
 *     rendered as NOTHING outside the live drag gesture (the height existed
 *     only as persisted metadata). The analysis IS the product: pads appear
 *     the moment they exist, in any view, not just sketch mode.
 *   - Cut/fill zones: per-cell quad mesh draped on the terrain under each
 *     pad — conflict red where the pad buries into the surface (excavate),
 *     Primary Gold where it floats above (build up).
 *
 * All geometry is memoised against (terrain, strokes) — this is a static
 * analysis, no useFrame. The store subscription to sketchStrokes re-renders
 * only when a stroke commits/updates (rare, same as FusedSketchLayer).
 *
 * Self-gating: subscribes earthworksView and returns null when off, when
 * the project has no terrain, or when no pads exist.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import {
  padStrokes,
  padCutFill,
  CUT_FILL_CELL_M,
  type PadStroke,
} from "./cutFill";

/** Base Y of the pad mass — matches the ink FLAT_Y z-fighting offset. */
const PAD_BASE_Y = 0.02;
/** Zone quads hover this far above the terrain surface (above ink 0.02). */
const ZONE_Y_OFFSET = 0.04;

export interface EarthworksLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — cut/fill is computed against this terrain surface. */
  heightmapPoints: HeightmapPoint[];
}

export function EarthworksLayer({
  scaleM,
  boardAspect,
  heightmapPoints,
}: EarthworksLayerProps) {
  const earthworksView = useStudioStore((s) => s.earthworksView);
  const strokes = useStudioStore((s) => s.sketchStrokes);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const pads = useMemo(
    () => padStrokes(strokes, scaleM, boardAspect),
    [strokes, scaleM, boardAspect],
  );

  if (!earthworksView || !sampler || pads.length === 0) return null;

  return (
    <group>
      {pads.map((pad) => (
        <PadEarthworks
          key={pad.stroke.id}
          pad={pad}
          sampler={sampler}
        />
      ))}
    </group>
  );
}

/** One pad: the committed extruded mass + its draped cut/fill zone mesh. */
function PadEarthworks({
  pad,
  sampler,
}: {
  pad: PadStroke;
  sampler: (worldX: number, worldZ: number) => number;
}) {
  // The committed mass — same construction as the live extrude preview in
  // FusedSketchLayer (ExtrudeMass), so committed pads match the gesture.
  const massGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Shape Y = NEGATED world Z (local +Y → world −Z under [-π/2,0,0]).
    shape.moveTo(pad.worldXZ[0]!.x, -pad.worldXZ[0]!.z);
    for (let i = 1; i < pad.worldXZ.length; i++) {
      shape.lineTo(pad.worldXZ[i]!.x, -pad.worldXZ[i]!.z);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: pad.heightM,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
  }, [pad.worldXZ, pad.heightM]);

  // The analysis + zone mesh — one pass: rasterise, integrate volumes, and
  // build a per-cell vertex-coloured quad mesh draped on the terrain.
  const analysis = useMemo(
    () => padCutFill(sampler, pad.worldXZ, pad.heightM, CUT_FILL_CELL_M),
    [sampler, pad.worldXZ, pad.heightM],
  );

  const zoneGeo = useMemo(() => {
    const cells = analysis.cells;
    const half = CUT_FILL_CELL_M / 2;
    const positions = new Float32Array(cells.length * 4 * 3);
    const colors = new Float32Array(cells.length * 4 * 3);
    const indices = new Uint32Array(cells.length * 6);
    // THREE.Color constructor converts sRGB hex → linear working space, so
    // vertexColors render correctly under the sRGB output colour space.
    const cut = new THREE.Color(PALETTE.gsConflict);
    const fill = new THREE.Color(PALETTE.gsPrimary);

    cells.forEach((cell, ci) => {
      const color = cell.diffM >= 0 ? fill : cut;
      const corners: Array<[number, number]> = [
        [cell.x - half, cell.z - half],
        [cell.x + half, cell.z - half],
        [cell.x + half, cell.z + half],
        [cell.x - half, cell.z + half],
      ];
      corners.forEach(([cx, cz], k) => {
        const y = sampler(cx, cz) + ZONE_Y_OFFSET;
        const o = (ci * 4 + k) * 3;
        positions[o] = cx;
        positions[o + 1] = y;
        positions[o + 2] = cz;
        colors[o] = color.r;
        colors[o + 1] = color.g;
        colors[o + 2] = color.b;
      });
      const v = ci * 4;
      indices.set([v, v + 1, v + 2, v, v + 2, v + 3], ci * 6);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }, [analysis, sampler]);

  return (
    <group>
      {/* Cut/fill zone patchwork on the terrain — red = excavate, gold = fill */}
      <mesh geometry={zoneGeo} renderOrder={2}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.38}
          depthWrite={false}
          side={THREE.DoubleSide}
          dithering
        />
      </mesh>

      {/* The committed pad mass — semi-transparent design volume */}
      <mesh
        geometry={massGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, PAD_BASE_Y, 0]}
        castShadow
        renderOrder={1}
      >
        <meshStandardMaterial
          color={PALETTE.summerGreen}
          emissive={PALETTE.summerGreen}
          emissiveIntensity={0.15}
          transparent
          opacity={0.35}
          roughness={0.7}
          metalness={0.05}
          dithering
        />
      </mesh>
    </group>
  );
}

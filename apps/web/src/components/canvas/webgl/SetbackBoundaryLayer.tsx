/**
 * AI Automated Site Setup — Site Context Layer (Phase 7).
 *
 * Renders two categories of AI-generated site context on the ground plane:
 *
 * 1. Legal setback lines — red dashed THREE.Line objects (LineDashedMaterial,
 *    color #ff3333) representing non-build zones.
 * 2. Building footprints — extruded 3D masses (THREE.Shape + ExtrudeGeometry)
 *    with a translucent dark-grey MeshStandardMaterial, representing the
 *    uneditable dwelling that frames the negative garden space.
 *
 * Both read from the studio store directly (same pattern as FeatureLayer,
 * CadProposalLayer, etc.). The extrusion mirrors the pad mass logic from
 * EarthworksLayer (Phase 6): Shape Y = negated world Z, rotated [-π/2,0,0].
 *
 * Three.js material values are exempt from the handoff chrome hex CI gate
 * (scripts/check-handoff-chrome-colors.mjs classifies style={{}} / SVG
 * stroke/fill, not material constructors).
 */

import { useMemo } from "react";
import { Line, Outlines } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";
import { SPATIAL_LAYER } from "./layerContract";
import type { PctPoint } from "./coordTransform";
import { pctToWorld } from "./coordTransform";
import { drapeRingToSurface } from "./terrainMath";

/** Red dashed setback line — strict legal non-build zone. */
const SETBACK_COLOR = "#ff3333";
/** Translucent dark grey for the uneditable house massing (TECHNICAL mode). */
const BUILDING_COLOR_TECHNICAL = "#3a3a3a";
/** Desaturated vellum/off-white for the architectural sketch look (IMMERSIVE). */
const BUILDING_COLOR_IMMERSIVE = "#e8e4dc";
/** Dark ink outline color for the NPR architectural sketch look. */
const BUILDING_OUTLINE_COLOR = "#2a2a2a";

export function SetbackBoundaryLayer({
  scaleM,
  boardAspect,
  sampler,
}: {
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  const setbackLines = useStudioStore((s) => s.setbackLines);
  const buildingFootprints = useStudioStore((s) => s.buildingFootprints);

  return (
    <>
      {setbackLines.map((line, i) => {
        if (line.points.length < 2) return null;
        const pctPoints: PctPoint[] = line.points.map((p) => ({
          x: p.x_pct,
          y: p.y_pct,
        }));
        const worldPoints = drapeRingToSurface(pctPoints, {
          sampler,
          scaleM,
          boardAspect,
          offsetM: SPATIAL_LAYER.semantic.offsetM,
        });
        return (
          <Line
            key={`setback-${line.id}-${i}`}
            points={worldPoints}
            color={SETBACK_COLOR}
            lineWidth={2}
            dashed
            dashSize={0.4}
            gapSize={0.3}
            transparent
            opacity={0.9}
            renderOrder={SPATIAL_LAYER.semantic.renderOrder}
          />
        );
      })}

      {buildingFootprints.map((footprint, i) => (
        <BuildingMass
          key={`building-${footprint.id}-${i}`}
          footprint={footprint}
          scaleM={scaleM}
          boardAspect={boardAspect}
          sampler={sampler}
        />
      ))}
    </>
  );
}

/**
 * One extruded building mass. Converts board-% points to world XZ, builds a
 * THREE.Shape, extrudes it to `height_m`, and renders it as a translucent
 * dark-grey mesh. Mirrors the pad extrusion from EarthworksLayer (Phase 6).
 */
function BuildingMass({
  footprint,
  scaleM,
  boardAspect,
  sampler,
}: {
  footprint: {
    id: string;
    points: Array<{ x_pct: number; y_pct: number }>;
    height_m: number;
    label?: string;
  };
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  const geo = useMemo(() => {
    if (footprint.points.length < 3) return null;
    const shape = new THREE.Shape();
    // Shape Y = NEGATED world Z (local +Y → world −Z under [-π/2,0,0]).
    // Same convention as EarthworksLayer pad extrusion.
    footprint.points.forEach((p, i) => {
      const [wx, wz] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      if (i === 0) shape.moveTo(wx, -wz);
      else shape.lineTo(wx, -wz);
    });
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: footprint.height_m,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
  }, [footprint.points, footprint.height_m, scaleM, boardAspect]);

  // Base Y — sit the mass on the terrain surface (or ground level if no
  // terrain sampler is available).
  const baseY = useMemo(() => {
    if (!sampler || footprint.points.length === 0) return 0;
    // Sample the average terrain height under the footprint centroid.
    const cx = footprint.points.reduce((s, p) => s + p.x_pct, 0) / footprint.points.length;
    const cy = footprint.points.reduce((s, p) => s + p.y_pct, 0) / footprint.points.length;
    const [wx, wz] = pctToWorld({ x: cx, y: cy }, scaleM, boardAspect);
    return sampler(wx, wz);
  }, [sampler, footprint.points, scaleM, boardAspect]);

  const renderMode = useStudioStore((s) => s.renderMode);
  const immersive = renderMode === "IMMERSIVE";

  if (!geo) return null;

  return (
    <mesh
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, baseY, 0]}
      castShadow
      receiveShadow
      renderOrder={SPATIAL_LAYER.semantic.renderOrder}
    >
      <meshStandardMaterial
        color={immersive ? BUILDING_COLOR_IMMERSIVE : BUILDING_COLOR_TECHNICAL}
        transparent
        opacity={immersive ? 0.75 : 0.55}
        roughness={immersive ? 0.95 : 0.8}
        metalness={0.1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
      {immersive && (
        <Outlines
          thickness={0.04}
          color={BUILDING_OUTLINE_COLOR}
          transparent
          opacity={0.6}
          screenspace={false}
          angle={Math.PI}
        />
      )}
    </mesh>
  );
}

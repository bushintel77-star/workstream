/**
 * Gold Standard 2026 — the 3D scene graph.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §2–3
 *
 * Renders inside the R3F <Canvas>. Contains:
 *   - Lighting (ambient + directional for sun)
 *   - Ground plane (--gs-canvas, adaptive grid)
 *   - Origin peg (Signal Blue crosshair at (0,0,0))
 *   - Lot boundary (Signal Blue line)
 *   - Easements (Signal Blue dashed lines)
 *   - Services (APWA-coloured lines)
 *   - Building footprint (extruded mesh)
 *   - Placed items (trees, regions, hardscape)
 *
 * Coordinate system: metre-space. % space (0–100) is converted via coordTransform.
 */

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { OrthographicCamera } from "three";
import * as THREE from "three";
import type { StudioCameraRig } from "./cameraRig";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { SceneItems, type RenderItem } from "./sceneItems";
import { StudioControls } from "./StudioControls";

export interface StudioSceneProps {
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  servicesPct?: PctPoint[][];
  items?: RenderItem[];
  buildingOpacity?: number;
  cameraRig: StudioCameraRig;
  onRigChange?: (rig: StudioCameraRig) => void;
  onGroundClick?: (pct: PctPoint) => void;
  onCursorMove?: (pct: PctPoint | null) => void;
}

/** Signal Blue origin peg — a crosshair at (0,0,0). */
function OriginPeg() {
  const blue = "#0030CF";
  const arm = 1.2;
  return (
    <group position={[0, 0, 0.01]}>
      <mesh>
        <boxGeometry args={[arm * 2, 0.08, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.08, arm * 2, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color={blue} />
      </mesh>
    </group>
  );
}

/** Convert a % ring to Three.js world line points (with small Z offset). */
function useWorldLine(points: PctPoint[], scaleM: number, boardAspect: number, z = 0.02) {
  return useMemo(
    () =>
      points.map(
        (p) => [...pctToWorld(p, scaleM, boardAspect), z] as [number, number, number],
      ),
    [points, scaleM, boardAspect, z],
  );
}

/** The lot boundary — a Signal Blue line. */
function LotBoundary({
  points,
  scaleM,
  boardAspect,
}: {
  points: PctPoint[];
  scaleM: number;
  boardAspect: number;
}) {
  const linePoints = useWorldLine(points, scaleM, boardAspect, 0.02);
  if (linePoints.length < 2) return null;
  return <Line points={linePoints} color="#0030CF" lineWidth={2} />;
}

/** Easements — Signal Blue dashed lines. */
function Easements({
  rings,
  scaleM,
  boardAspect,
}: {
  rings: PctPoint[][];
  scaleM: number;
  boardAspect: number;
}) {
  return (
    <>
      {rings.map((ring, i) => {
        if (ring.length < 2) return null;
        const pts = ring.map(
          (p) => [...pctToWorld(p, scaleM, boardAspect), 0.015] as [number, number, number],
        );
        return (
          <Line
            key={`easement-${i}`}
            points={pts}
            color="#0030CF"
            lineWidth={1}
            dashed
            dashSize={0.4}
            gapSize={0.3}
            opacity={0.5}
            transparent
          />
        );
      })}
    </>
  );
}

/** Services / utility corridors — coloured by APWA convention. */
function Services({
  lines,
  scaleM,
  boardAspect,
}: {
  lines: PctPoint[][];
  scaleM: number;
  boardAspect: number;
}) {
  const apwaColors = ["#1e88c7", "#2f8f4e", "#e8b000", "#d63b2f", "#e8722f"];
  return (
    <>
      {lines.map((line, i) => {
        if (line.length < 2) return null;
        const pts = line.map(
          (p) => [...pctToWorld(p, scaleM, boardAspect), 0.012] as [number, number, number],
        );
        return (
          <Line
            key={`service-${i}`}
            points={pts}
            color={apwaColors[i % apwaColors.length]}
            lineWidth={1.5}
            dashed
            dashSize={0.3}
            gapSize={0.2}
          />
        );
      })}
    </>
  );
}

/** The building footprint — a flat mesh with opacity. */
function BuildingFootprint({
  points,
  scaleM,
  boardAspect,
  opacity = 1,
}: {
  points: PctPoint[];
  scaleM: number;
  boardAspect: number;
  opacity?: number;
}) {
  const shape = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape();
    const world = points.map((p) => pctToWorld(p, scaleM, boardAspect));
    shape.moveTo(world[0][0], world[0][1]);
    for (let i = 1; i < world.length; i++) shape.lineTo(world[i][0], world[i][1]);
    shape.closePath();
    return shape;
  }, [points, scaleM, boardAspect]);

  if (!shape) return null;
  return (
    <mesh position={[0, 0, 0.015]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#1e2329" transparent opacity={opacity} roughness={0.9} />
    </mesh>
  );
}

/** The ground plane — --gs-canvas with a grid. */
function GroundPlane({ scaleM, boardAspect }: { scaleM: number; boardAspect: number }) {
  const w = scaleM * 3;
  const h = scaleM * boardAspect * 3;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#101418" />
      </mesh>
      <gridHelper args={[w, Math.round(w), "#2e343c", "#23282e"]} position={[0, 0.001, 0]} />
    </>
  );
}

/** Camera controller — applies the rig state to the ortho camera. */
function CameraController({ rig }: { rig: StudioCameraRig }) {
  const { camera } = useThree();

  useFrame(() => {
    const cam = camera as OrthographicCamera;
    const tiltRad = (rig.tiltDeg * Math.PI) / 180;
    const rotateRad = (rig.rotateDeg * Math.PI) / 180;
    const height = 100;

    cam.position.set(
      rig.panX,
      height * Math.cos(tiltRad),
      height * Math.sin(tiltRad) + rig.panY,
    );
    cam.zoom = rig.zoom * 8;
    cam.rotation.set(-tiltRad, 0, -rotateRad);
    cam.updateProjectionMatrix();
  });

  return null;
}

export function StudioScene({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct = [],
  servicesPct = [],
  items = [],
  buildingOpacity = 1,
  cameraRig,
  onRigChange,
  onGroundClick,
  onCursorMove,
}: StudioSceneProps) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={0.3} />

      <CameraController rig={cameraRig} />

      {/* Input capture — invisible ground plane for raycasting */}
      {onRigChange && (
        <StudioControls
          scaleM={scaleM}
          boardAspect={boardAspect}
          rig={cameraRig}
          onRigChange={onRigChange}
          onGroundClick={onGroundClick}
          onCursorMove={onCursorMove}
          tiltLocked={cameraRig.tiltDeg > 0.5}
        />
      )}

      <GroundPlane scaleM={scaleM} boardAspect={boardAspect} />
      <OriginPeg />
      <LotBoundary points={boundaryPct} scaleM={scaleM} boardAspect={boardAspect} />
      {buildingPct && buildingPct.length >= 3 && (
        <BuildingFootprint
          points={buildingPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
          opacity={buildingOpacity}
        />
      )}
      <Easements rings={easementsPct} scaleM={scaleM} boardAspect={boardAspect} />
      <Services lines={servicesPct} scaleM={scaleM} boardAspect={boardAspect} />
      <SceneItems items={items} scaleM={scaleM} boardAspect={boardAspect} />
    </>
  );
}

/**
 * Gold Standard 2026 — the 3D scene graph.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §2–3
 *
 * This is the R3F scene rendered inside <Canvas>. It contains:
 *   - Lighting (ambient + directional for sun)
 *   - The ground plane (--gs-canvas, adaptive grid)
 *   - The origin peg (Signal Blue crosshair at (0,0,0))
 *   - The lot boundary (Signal Blue line)
 *   - The building footprint (extruded mesh, opacity-gated)
 *
 * Coordinate system: metre-space. % space (0–100) is converted to metres via
 * pctToMetres at the component boundary. Origin (0,0,0) is the survey peg.
 *
 * The scene is consumed by WebGLStudio — it never renders DOM chrome. All
 * overlay UI lives in the sibling DOM layer (Layer 3).
 */

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { OrthographicCamera } from "three";
import * as THREE from "three";
import type { StudioCameraRig } from "./cameraRig";

export interface StudioSceneProps {
  scaleM: number;
  boardAspect: number;
  boundaryPct: Array<{ x: number; y: number }>;
  buildingPct?: Array<{ x: number; y: number }>;
  cameraRig: StudioCameraRig;
}

/**
 * Convert a % space point (0–100) to metre-space world coordinates.
 * The lot spans `scaleM` metres across its shorter axis. The X axis maps
 * directly; the Y axis is divided by boardAspect (height/width) to account
 * for the non-uniform stretch that preserveAspectRatio="none" used to handle.
 */
function pctToWorld(
  pct: { x: number; y: number },
  scaleM: number,
  boardAspect: number,
): [number, number] {
  const xM = (pct.x / 100) * scaleM;
  const yM = (pct.y / 100) * scaleM * boardAspect;
  // Centre the lot on the origin peg
  return [xM - scaleM / 2, yM - (scaleM * boardAspect) / 2];
}

/** Signal Blue origin peg — a crosshair at (0,0,0). */
function OriginPeg() {
  const blue = "#0030CF";
  const armLength = 1.2;
  return (
    <group position={[0, 0, 0.01]}>
      {/* Horizontal arm */}
      <mesh>
        <boxGeometry args={[armLength * 2, 0.08, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      {/* Vertical arm */}
      <mesh>
        <boxGeometry args={[0.08, armLength * 2, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      {/* Centre dot */}
      <mesh>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color={blue} />
      </mesh>
    </group>
  );
}

/** The lot boundary — a Signal Blue line in metre-space. */
function LotBoundary({
  points,
  scaleM,
  boardAspect,
}: {
  points: Array<{ x: number; y: number }>;
  scaleM: number;
  boardAspect: number;
}) {
  const worldPoints = useMemo(
    () =>
      points.map(
        (p) => [...pctToWorld(p, scaleM, boardAspect), 0.02] as [number, number, number],
      ),
    [points, scaleM, boardAspect],
  );

  if (worldPoints.length < 2) return null;
  return (
    <Line points={worldPoints} color="#0030CF" lineWidth={2} />
  );
}

/** The building footprint — an extruded mesh, opacity-gated. */
function BuildingFootprint({
  points,
  scaleM,
  boardAspect,
  opacity = 1,
}: {
  points: Array<{ x: number; y: number }>;
  scaleM: number;
  boardAspect: number;
  opacity?: number;
}) {
  const shape = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape();
    const world = points.map((p) => pctToWorld(p, scaleM, boardAspect));
    shape.moveTo(world[0][0], world[0][1]);
    for (let i = 1; i < world.length; i++) {
      shape.lineTo(world[i][0], world[i][1]);
    }
    shape.closePath();
    return shape;
  }, [points, scaleM, boardAspect]);

  if (!shape) return null;

  return (
    <mesh position={[0, 0, 0.015]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        color="#1e2329"
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

/** The ground plane — --gs-canvas with a subtle grid. */
function GroundPlane({ scaleM, boardAspect }: { scaleM: number; boardAspect: number }) {
  const w = scaleM * 2;
  const h = scaleM * boardAspect * 2;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#101418" />
      </mesh>
      {/* Grid overlay */}
      <gridHelper
        args={[w, Math.round(w), "#2e343c", "#23282e"]}
        position={[0, 0, 0.001]}
      />
    </>
  );
}

/**
 * Camera controller — applies the rig state (pan/zoom/rotate/tilt) to the
 * orthographic camera each frame. This replaces the CSS transform on .zoomWorld.
 */
function CameraController({ rig }: { rig: StudioCameraRig }) {
  const { camera } = useThree();

  useFrame(() => {
    const cam = camera as OrthographicCamera;
    const tiltRad = (rig.tiltDeg * Math.PI) / 180;
    const rotateRad = (rig.rotateDeg * Math.PI) / 180;
    const height = 100;

    // Tilt: lower the camera from top-down to oblique.
    // At tilt=0: looking straight down (-Z in our Y-up scene means looking down -Y... )
    // We use the convention: camera at [panX, height*cos(tilt), height*sin(tilt)]
    // looking at [panX, panY, 0].
    cam.position.set(
      rig.panX,
      height * Math.cos(tiltRad),
      height * Math.sin(tiltRad) + rig.panY,
    );
    cam.zoom = rig.zoom * 8;
    cam.rotation.set(
      -tiltRad,
      0,
      -rotateRad,
    );
    cam.updateProjectionMatrix();
  });

  return null;
}

export function StudioScene({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  cameraRig,
}: StudioSceneProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={0.3} />

      {/* Camera */}
      <CameraController rig={cameraRig} />

      {/* Scene content */}
      <GroundPlane scaleM={scaleM} boardAspect={boardAspect} />
      <OriginPeg />
      <LotBoundary points={boundaryPct} scaleM={scaleM} boardAspect={boardAspect} />
      {buildingPct && buildingPct.length >= 3 && (
        <BuildingFootprint
          points={buildingPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
        />
      )}
    </>
  );
}

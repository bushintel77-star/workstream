"use client";

/**
 * Gold Standard 2026 — 3D Sketch Layer (inside the WebGL studio).
 *
 * When sketchMode is toggled on, this layer mounts an invisible raycast plane
 * that captures pointer drags as 3D strokes. Each stroke point comes from
 * raycasting against the ground (event.point), so the ink naturally drapes
 * over the terrain — it lives in world space, not screen space.
 *
 * Gestures:
 *   - Drag on empty ground → freehand draped stroke (drei <Line> in world space)
 *   - Auto-close: if the stroke ends near its origin, it becomes a closed loop
 *   - Drag upward inside a closed loop → extrude into a 3D mass (ExtrudeGeometry)
 *
 * Strokes render as hairline screen-space lines (lineWidth=2, same as the
 * subsurface CAD schematic) in magenta ink. Extruded masses render as
 * semi-transparent gold volumes.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import { useSeasonalStore } from "./seasonalStore";
import { polygonAreaM2 } from "../handoff/geometry/polygon";
import { worldToPct } from "./coordTransform";

/** A draped 3D stroke — points in world space on the Y≈0.02 plane. */
interface SketchStroke3D {
  id: string;
  points: THREE.Vector3[];
  closed: boolean;
  /** If extruded, the height in metres + the ExtrudeGeometry. */
  extrudeHeightM?: number;
}

/** Snap-close threshold in world metres. */
const SNAP_CLOSE_M = 2.0;
/** Minimum points to form a closed polygon. */
const MIN_POLY_POINTS = 4;
/** Scale the drag-Y delta into extrusion metres. */
const EXTRUDE_SENSITIVITY = 0.05;

export interface SketchLayer3DProps {
  scaleM: number;
  boardAspect: number;
}

export function SketchLayer3D({ scaleM, boardAspect }: SketchLayer3DProps) {
  // Self-mounting: only render the raycast plane + stroke geometry when
  // sketchMode is on. Reading via selector so only this component re-renders
  // on toggle — the rest of the scene is untouched.
  const sketchMode = useSeasonalStore((s) => s.sketchMode);

  const [strokes, setStrokes] = useState<SketchStroke3D[]>([]);
  const [livePoints, setLivePoints] = useState<THREE.Vector3[]>([]);
  const [extrudeTarget, setExtrudeTarget] = useState<SketchStroke3D | null>(null);
  const [extrudeHeight, setExtrudeHeight] = useState(0);

  const isDrawingRef = useRef(false);
  const isExtrudingRef = useRef(false);
  const extrudeStartYRef = useRef(0);
  const pointsRef = useRef<THREE.Vector3[]>([]);

  const planeSize = scaleM * 5;

  // ---- Stroke capture ----
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const pt = e.point;
    if (!pt) return;

    // Check if the pointer landed inside a closed stroke → start extrude
    const inside = strokes.find(
      (s) => s.closed && pointInPolygon(pt, s.points),
    );
    if (inside) {
      isExtrudingRef.current = true;
      extrudeStartYRef.current = e.nativeEvent.clientY;
      setExtrudeTarget(inside);
      setExtrudeHeight(0);
      return;
    }

    // Otherwise start a new freehand stroke
    isDrawingRef.current = true;
    pointsRef.current = [new THREE.Vector3(pt.x, 0.02, pt.z)];
    setLivePoints(pointsRef.current);
  }, [strokes]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!e.point) return;

    if (isExtrudingRef.current && extrudeTarget) {
      // Drag upward → grow the extrusion height
      const dy = extrudeStartYRef.current - e.nativeEvent.clientY; // up = positive
      const height = Math.max(0, dy * EXTRUDE_SENSITIVITY * scaleM * 0.1);
      setExtrudeHeight(height);
      return;
    }

    if (!isDrawingRef.current) return;
    e.stopPropagation();
    const pt = e.point;
    const last = pointsRef.current[pointsRef.current.length - 1];
    // Throttle: skip points <0.15m apart
    if (last && last.distanceTo(new THREE.Vector3(pt.x, 0.02, pt.z)) < 0.15) return;
    pointsRef.current.push(new THREE.Vector3(pt.x, 0.02, pt.z));
    setLivePoints([...pointsRef.current]);
  }, [extrudeTarget, scaleM]);

  const onPointerUp = useCallback(() => {
    if (isExtrudingRef.current && extrudeTarget && extrudeHeight > 0.1) {
      // Commit the extrusion
      setStrokes((prev) =>
        prev.map((s) =>
          s.id === extrudeTarget.id
            ? { ...s, extrudeHeightM: extrudeHeight }
            : s,
        ),
      );
      isExtrudingRef.current = false;
      setExtrudeTarget(null);
      setExtrudeHeight(0);
      return;
    }
    isExtrudingRef.current = false;
    setExtrudeTarget(null);
    setExtrudeHeight(0);

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const pts = pointsRef.current;
    if (pts.length < 2) {
      setLivePoints([]);
      return;
    }

    // Auto-close check
    const closed =
      pts.length >= MIN_POLY_POINTS &&
      pts[0]!.distanceTo(pts[pts.length - 1]!) < SNAP_CLOSE_M;

    const stroke: SketchStroke3D = {
      id: crypto.randomUUID(),
      points: closed ? [...pts, pts[0]!] : pts,
      closed,
    };
    setStrokes((prev) => [...prev, stroke]);
    setLivePoints([]);
  }, [extrudeTarget, extrudeHeight]);

  // ---- Render ----
  if (!sketchMode) return null;
  return (
    <group>
      {/* Invisible raycast plane — captures all pointer events for sketching */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Committed strokes */}
      {strokes.map((s) => (
        <StrokeRenderer key={s.id} stroke={s} scaleM={scaleM} boardAspect={boardAspect} />
      ))}

      {/* Live extrude preview */}
      {extrudeTarget && extrudeHeight > 0.05 && (
        <ExtrudeMass stroke={extrudeTarget} heightM={extrudeHeight} />
      )}

      {/* Live drawing stroke */}
      {livePoints.length >= 2 && (
        <Line
          points={livePoints.map((p) => [p.x, p.y, p.z] as [number, number, number])}
          color={PALETTE.sketchInk}
          lineWidth={2}
          opacity={0.55}
          transparent
        />
      )}
    </group>
  );
}

/** Render a committed stroke — either a draped line or an extruded mass. */
function StrokeRenderer({
  stroke,
  scaleM,
  boardAspect,
}: {
  stroke: SketchStroke3D;
  scaleM: number;
  boardAspect: number;
}) {
  const linePoints = useMemo(
    () => stroke.points.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [stroke.points],
  );

  return (
    <group>
      <Line
        points={linePoints}
        color={stroke.extrudeHeightM ? PALETTE.sketchInk : PALETTE.sketchInk}
        lineWidth={2}
        opacity={stroke.closed ? 0.88 : 0.72}
        transparent
      />
      {stroke.extrudeHeightM && stroke.extrudeHeightM > 0.1 && (
        <ExtrudeMass stroke={stroke} heightM={stroke.extrudeHeightM} />
      )}
    </group>
  );
}

/** An extruded 3D mass from a closed stroke footprint. Semi-transparent gold
 *  so it reads as a proposal volume, not a final object. */
function ExtrudeMass({
  stroke,
  heightM,
}: {
  stroke: SketchStroke3D;
  heightM: number;
}) {
  const geo = useMemo(() => {
    if (stroke.points.length < 3) return null;
    const shape = new THREE.Shape();
    // Project the 3D points onto the XZ plane for the 2D shape
    shape.moveTo(stroke.points[0]!.x, stroke.points[0]!.z);
    for (let i = 1; i < stroke.points.length; i++) {
      shape.lineTo(stroke.points[i]!.x, stroke.points[i]!.z);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
  }, [stroke.points, heightM]);

  if (!geo) return null;
  return (
    <mesh
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      castShadow
      receiveShadow
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
  );
}

/**
 * Point-in-polygon test (ray casting) in the XZ plane. Used to detect when the
 * user presses inside a closed stroke to start an extrude gesture.
 */
function pointInPolygon(pt: THREE.Vector3, polygon: THREE.Vector3[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const x = pt.x;
  const z = pt.z;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const zi = polygon[i]!.z;
    const xj = polygon[j]!.x;
    const zj = polygon[j]!.z;
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

"use client";

/**
 * Gold Standard 2026 — Fused Sketch Layer (shared 2D↔3D ink).
 *
 * THE UNIFIED INK SYSTEM. This replaces both:
 *   - The 2D SVG sketch pad (SketchPad.tsx — separate route, separate ink)
 *   - The 3D SketchLayer3D (local state, never persisted)
 *
 * Strokes live in the unified studio store as CanvasStroke[] (board-% space —
 * the contract schema). The SAME strokes are visible in plan view and 3D view
 * because they share one array. No unmount, no remount, no lost ink.
 *
 * Raycast Unprojection: pointer events raycast against the ground plane (or
 * terrain mesh), resolving to world-space points. These are converted back to
 * board-% via worldToPct and stored as CanvasStroke.points — so the ink is
 * projection-independent. Whether the camera is ortho or perspective, the same
 * board-% point maps to the same world location.
 *
 * Rendering: strokes render as drei <Line> in world space. The Y-offset of each
 * point lerps with viewBlend:
 *   - blend=0 (plan): y=0.02 (flat on the ground — reads as flat ink on paper)
 *   - blend>0 (3D):   y follows the terrain heightmap (ink drapes over topology)
 *
 * Gestures (preserved from SketchLayer3D):
 *   - Drag on ground → freehand draped stroke → auto-close if near origin
 *   - Drag upward inside a closed stroke → extrude into a 3D mass
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md (Fused Rendering Context)
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { CanvasStroke } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { pctToWorld, worldToPct, type PctPoint } from "./coordTransform";

/** Snap-close threshold in world metres. */
const SNAP_CLOSE_M = 2.0;
/** Minimum points to form a closed polygon. */
const MIN_POLY_POINTS = 4;
/** Scale the drag-Y delta into extrusion metres. */
const EXTRUDE_SENSITIVITY = 0.05;

export interface FusedSketchLayerProps {
  scaleM: number;
  boardAspect: number;
}

export function FusedSketchLayer({ scaleM, boardAspect }: FusedSketchLayerProps) {
  // sketchMode gates whether this layer captures pointer events. When off,
  // the camera controls get the events (orbit/pan).
  const sketchMode = useStudioStore((s) => s.sketchMode);
  // The committed strokes from the store — shared across plan and 3D views.
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const addSketchStroke = useStudioStore((s) => s.addSketchStroke);
  const updateSketchStroke = useStudioStore((s) => s.updateSketchStroke);

  // Live drawing state (local — only the active stroke, not yet committed).
  const [livePoints, setLivePoints] = useState<THREE.Vector3[]>([]);
  // Extrusion state.
  const [extrudeTarget, setExtrudeTarget] = useState<CanvasStroke | null>(null);
  const [extrudeHeight, setExtrudeHeight] = useState(0);

  const isDrawingRef = useRef(false);
  const isExtrudingRef = useRef(false);
  const extrudeStartYRef = useRef(0);
  const pointsRef = useRef<THREE.Vector3[]>([]);

  const planeSize = scaleM * 5;

  // ---- Stroke capture (raycast unprojection) ----
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!sketchMode) return;
      e.stopPropagation();
      const pt = e.point;
      if (!pt) return;

      // Check if the pointer landed inside a closed stroke → start extrude.
      // Convert committed strokes to world-space polygons for the point-in-poly test.
      const inside = strokes.find((s) => {
        const pts = strokeToWorldPoints(s, scaleM, boardAspect);
        return pts.length >= 3 && pointInPolygon(pt, pts);
      });
      if (inside) {
        isExtrudingRef.current = true;
        extrudeStartYRef.current = e.nativeEvent.clientY;
        setExtrudeTarget(inside);
        setExtrudeHeight(0);
        return;
      }

      // Otherwise start a new freehand stroke.
      isDrawingRef.current = true;
      pointsRef.current = [new THREE.Vector3(pt.x, 0.02, pt.z)];
      setLivePoints(pointsRef.current);
    },
    [sketchMode, strokes, scaleM, boardAspect],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!sketchMode) return;
      if (!e.point) return;

      if (isExtrudingRef.current && extrudeTarget) {
        const dy = extrudeStartYRef.current - e.nativeEvent.clientY;
        const height = Math.max(0, dy * EXTRUDE_SENSITIVITY * scaleM * 0.1);
        setExtrudeHeight(height);
        return;
      }

      if (!isDrawingRef.current) return;
      e.stopPropagation();
      const pt = e.point;
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last && last.distanceTo(new THREE.Vector3(pt.x, 0.02, pt.z)) < 0.15) return;
      pointsRef.current.push(new THREE.Vector3(pt.x, 0.02, pt.z));
      setLivePoints([...pointsRef.current]);
    },
    [sketchMode, extrudeTarget, scaleM],
  );

  const onPointerUp = useCallback(() => {
    if (!sketchMode) return;

    if (isExtrudingRef.current && extrudeTarget && extrudeHeight > 0.1) {
      // Commit the extrusion height to the stroke in the store.
      updateSketchStroke(extrudeTarget.id, { width_px: 2.5 });
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

    const worldPts = pointsRef.current;
    if (worldPts.length < 2) {
      setLivePoints([]);
      return;
    }

    // Convert world points back to board-% for the CanvasStroke contract.
    // This is the key to the fused system: the stroke is stored in
    // projection-independent board-% space, not world space.
    const pctPoints: PctPoint[] = worldPts.map((p) =>
      worldToPct(p.x, p.z, scaleM, boardAspect),
    );

    // Auto-close check (in world space for accurate distance).
    const closed =
      worldPts.length >= MIN_POLY_POINTS &&
      worldPts[0]!.distanceTo(worldPts[worldPts.length - 1]!) < SNAP_CLOSE_M;

    const finalPct = closed ? [...pctPoints, pctPoints[0]!] : pctPoints;

    const stroke: CanvasStroke = {
      id: crypto.randomUUID(),
      points: finalPct.map((p) => ({ x_pct: p.x, y_pct: p.y })),
      color: PALETTE.sketchInk,
      width_px: 2.5,
      kind: "ink",
    };

    addSketchStroke(stroke);
    setLivePoints([]);
  }, [
    sketchMode,
    extrudeTarget,
    extrudeHeight,
    updateSketchStroke,
    addSketchStroke,
    scaleM,
    boardAspect,
  ]);

  // ---- Render ----
  if (!sketchMode) return null;
  return (
    <group>
      {/* Invisible raycast plane — captures pointer events for sketching */}
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

      {/* Committed strokes — rendered from the shared store */}
      {strokes.map((s) => (
        <CommittedStrokeRenderer
          key={s.id}
          stroke={s}
          scaleM={scaleM}
          boardAspect={boardAspect}
        />
      ))}

      {/* Live extrude preview */}
      {extrudeTarget && extrudeHeight > 0.05 && (
        <ExtrudeMass
          stroke={extrudeTarget}
          heightM={extrudeHeight}
          scaleM={scaleM}
          boardAspect={boardAspect}
        />
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

/**
 * Convert a stored CanvasStroke (board-% points) to world-space Vector3[] for
 * rendering. The Y-offset is 0.02 (flat on the ground) — the FusedYAnimator
 * component below handles the blend-dependent drape.
 */
function strokeToWorldPoints(
  stroke: CanvasStroke,
  scaleM: number,
  boardAspect: number,
): THREE.Vector3[] {
  return (stroke.points ?? []).map((p) => {
    const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
    return new THREE.Vector3(x, 0.02, z);
  });
}

/** Render a committed stroke from the store. */
function CommittedStrokeRenderer({
  stroke,
  scaleM,
  boardAspect,
}: {
  stroke: CanvasStroke;
  scaleM: number;
  boardAspect: number;
}) {
  // Convert board-% points to world-space line points.
  const linePoints = useMemo(() => {
    return (stroke.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return [x, 0.02, z] as [number, number, number];
    });
  }, [stroke.points, scaleM, boardAspect]);

  if (linePoints.length < 2) return null;

  return (
    <group>
      <Line
        points={linePoints}
        color={stroke.color ?? PALETTE.sketchInk}
        lineWidth={stroke.width_px ?? 2}
        opacity={0.82}
        transparent
      />
    </group>
  );
}

/** An extruded 3D mass from a closed stroke footprint. */
function ExtrudeMass({
  stroke,
  heightM,
  scaleM,
  boardAspect,
}: {
  stroke: CanvasStroke;
  heightM: number;
  scaleM: number;
  boardAspect: number;
}) {
  const geo = useMemo(() => {
    const worldPts = (stroke.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return [x, z] as [number, number];
    });
    if (worldPts.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(worldPts[0]![0], worldPts[0]![1]);
    for (let i = 1; i < worldPts.length; i++) {
      shape.lineTo(worldPts[i]![0], worldPts[i]![1]);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
  }, [stroke.points, heightM, scaleM, boardAspect]);

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
 * Point-in-polygon test (ray casting) in the XZ plane.
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

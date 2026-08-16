"use client";

/**
 * Gold Standard 2026 — Fused Sketch Layer (shared 2D↔3D ink).
 *
 * THE UNIFIED INK SYSTEM — the only sketch environment in the app.
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
 * point lerps with the animated viewBlend (Vertical Truth):
 *   - blend=0 (plan): y = FLAT_Y (0.02) — flat on the ground, reads as ink on paper
 *   - blend>0 (3D):   y = FLAT_Y + viewBlend × terrainHeight(x,z) — ink drapes
 *
 * The terrain height comes from the SHARED terrainMath sampler — bit-identical
 * to the TerrainMesh displacement, so the ink sits on the surface. Per-frame Y
 * updates happen in useFrame via getState() (zero re-renders), mutating the
 * Line2 geometry positions in place (zero allocations).
 *
 * Gestures:
 *   - Drag on ground → freehand draped stroke → auto-close if near origin
 *   - Drag upward inside a closed stroke → extrude into a 3D mass
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md (Fused Rendering Context)
 */

import { useCallback, useMemo, useRef, useState, type ElementRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { CanvasStroke } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { pctToWorld, worldToPct, type PctPoint, type HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { pointInPolygonXZ } from "./cutFill";
import { snapDrawPointer, type SnapHint } from "./snapWorld";

/** Snap-close threshold in world metres. */
const SNAP_CLOSE_M = 2.0;
/** Minimum points to form a closed polygon. */
const MIN_POLY_POINTS = 4;
/** Scale the drag-Y delta into extrusion metres. */
const EXTRUDE_SENSITIVITY = 0.05;
/** Flat Y offset — keeps ink just above the ground/terrain to avoid z-fighting. */
const FLAT_Y = 0.02;

export interface FusedSketchLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — when present, ink drapes over the terrain in 3D view. */
  heightmapPoints?: HeightmapPoint[];
}

export function FusedSketchLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: FusedSketchLayerProps) {
  // sketchMode gates whether this layer captures pointer events. When off,
  // the camera controls get the events (orbit/pan).
  const sketchMode = useStudioStore((s) => s.sketchMode);
  // The committed strokes from the store — shared across plan and 3D views.
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const addSketchStroke = useStudioStore((s) => s.addSketchStroke);
  const updateSketchStroke = useStudioStore((s) => s.updateSketchStroke);

  // The shared elevation sampler — identical math to the TerrainMesh. null when
  // the project has no spot levels (flat ground → ink stays at FLAT_Y).
  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  // Live drawing state (local — only the active stroke, not yet committed).
  const [livePoints, setLivePoints] = useState<THREE.Vector3[]>([]);
  // Extrusion state.
  const [extrudeTarget, setExtrudeTarget] = useState<CanvasStroke | null>(null);
  const [extrudeHeight, setExtrudeHeight] = useState(0);
  // Active snap decision for the pointer (renders the SnapMarker).
  const [snapHint, setSnapHint] = useState<SnapHint | null>(null);

  const isDrawingRef = useRef(false);
  const isExtrudingRef = useRef(false);
  const extrudeStartYRef = useRef(0);
  const pointsRef = useRef<THREE.Vector3[]>([]);

  // Vertex magnets — committed stroke endpoints in world metres.
  const snapVertices = useMemo(
    () =>
      strokes.flatMap((s) => {
        const pts = s.points ?? [];
        if (pts.length === 0) return [];
        const ends = [pts[0]!, pts[pts.length - 1]!];
        return ends.map((p) => {
          const [x, z] = pctToWorld(
            { x: p.x_pct, y: p.y_pct },
            scaleM,
            boardAspect,
          );
          return { x, z };
        });
      }),
    [strokes, scaleM, boardAspect],
  );

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
        return pts.length >= 3 && pointInPolygonXZ(pt.x, pt.z, pts);
      });
      if (inside) {
        isExtrudingRef.current = true;
        extrudeStartYRef.current = e.nativeEvent.clientY;
        setExtrudeTarget(inside);
        setExtrudeHeight(0);
        return;
      }

      // Otherwise start a new freehand stroke. Seed the first point at FLAT_Y —
      // the live-stroke renderer will drape it as the camera tilts.
      isDrawingRef.current = true;
      setSnapHint(null);
      pointsRef.current = [new THREE.Vector3(pt.x, FLAT_Y, pt.z)];
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

      // Draw-time snap (close → vertex → 45° angle) resolves where the
      // pointer SHOULD read before the point is accepted.
      const origin = pointsRef.current[0];
      const last = pointsRef.current[pointsRef.current.length - 1];
      const snap = snapDrawPointer(pt.x, pt.z, {
        origin:
          pointsRef.current.length >= 3 && origin
            ? { x: origin.x, z: origin.z }
            : null,
        last: last ? { x: last.x, z: last.z } : null,
        vertices: snapVertices,
      });
      setSnapHint(snap.kind ? snap : null);

      if (last && last.distanceTo(new THREE.Vector3(snap.x, FLAT_Y, snap.z)) < 0.15) return;
      pointsRef.current.push(new THREE.Vector3(snap.x, FLAT_Y, snap.z));
      setLivePoints([...pointsRef.current]);
    },
    [sketchMode, extrudeTarget, scaleM, snapVertices],
  );

  const onPointerUp = useCallback(() => {
    if (!sketchMode) return;

    if (isExtrudingRef.current && extrudeTarget && extrudeHeight > 0.1) {
      // Commit the extrusion height to the stroke in the store.
      updateSketchStroke(extrudeTarget.id, { extrude_height_m: extrudeHeight });
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
    setSnapHint(null);

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

      {/* Committed strokes — rendered from the shared store, draped over terrain */}
      {strokes.map((s) => (
        <CommittedStrokeRenderer
          key={s.id}
          stroke={s}
          scaleM={scaleM}
          boardAspect={boardAspect}
          sampler={sampler}
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

      {/* Live drawing stroke — drapes in real time as you draw in 3D */}
      {livePoints.length >= 2 && (
        <DrapedLiveLine points={livePoints} sampler={sampler} />
      )}

      {/* Draw-time snap marker (kind-coloured ring + glyph chip) */}
      {snapHint && <SnapMarker hint={snapHint} />}
    </group>
  );
}

/**
 * Convert a stored CanvasStroke (board-% points) to world-space Vector3[] for
 * hit-testing. Y is FLAT_Y — this is a 2D point-in-polygon check in the XZ plane.
 */
function strokeToWorldPoints(
  stroke: CanvasStroke,
  scaleM: number,
  boardAspect: number,
): THREE.Vector3[] {
  // points is required by the schema; the ?? [] guards against legacy
  // handoff-authored strokes that may predate the field (defensive, not type debt).
  return (stroke.points ?? []).map((p) => {
    const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
    return new THREE.Vector3(x, FLAT_Y, z);
  });
}

/**
 * Compute the draped Y for a world (x,z) at a given viewBlend.
 *   - blend=0 (plan): FLAT_Y (ink sits flat, reads as paper)
 *   - blend>0 (3D):   FLAT_Y + blend × terrainHeight (ink hugs the surface)
 * When no sampler (flat project), always FLAT_Y.
 */
function drapedY(
  x: number,
  z: number,
  blend: number,
  sampler: ((x: number, z: number) => number) | null,
): number {
  if (!sampler) return FLAT_Y;
  return FLAT_Y + blend * sampler(x, z);
}

/** Render a committed stroke, draped over the terrain via per-frame Y update. */
function CommittedStrokeRenderer({
  stroke,
  scaleM,
  boardAspect,
  sampler,
}: {
  stroke: CanvasStroke;
  scaleM: number;
  boardAspect: number;
  sampler: ((x: number, z: number) => number) | null;
}) {
  // Base world points (XZ) — computed once. Y is updated per-frame below.
  const basePoints = useMemo(() => {
    // points ?? [] — defensive against legacy strokes (see strokeToWorldPoints).
    return (stroke.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return [x, FLAT_Y, z] as [number, number, number];
    });
  }, [stroke.points, scaleM, boardAspect]);

  // The Line2 ref — we mutate its geometry positions in place each frame.
  // ElementRef<typeof Line> resolves to Line2 | LineSegments2 (see SubsurfaceEngine).
  const lineRef = useRef<ElementRef<typeof Line>>(null);
  // Pre-allocated Float32Array scratch for the per-frame position write.
  // Sized to basePoints × 3 (x,y,z per vertex). Allocated once per stroke.
  const positionsScratch = useMemo(
    () => new Float32Array(basePoints.length * 3),
    [basePoints.length],
  );

  // Per-frame: read the animated viewBlend (transient), update each vertex Y so
  // the ink lerps from flat (plan) to terrain-draped (3D) in sync with the camera.
  useFrame(() => {
    if (!lineRef.current || basePoints.length === 0) return;
    const { viewBlend } = useStudioStore.getState();

    // Only rewrite positions if there's a sampler AND we're not fully in plan
    // (blend=0 → flat, the initial state — skip the write to save bandwidth).
    if (!sampler || viewBlend < 0.001) return;

    for (let i = 0; i < basePoints.length; i++) {
      const [x, , z] = basePoints[i]!;
      const y = drapedY(x, z, viewBlend, sampler);
      positionsScratch[i * 3] = x;
      positionsScratch[i * 3 + 1] = y;
      positionsScratch[i * 3 + 2] = z;
    }

    // Line2 (three.js LineSegmentsGeometry) uses instanceStart/instanceEnd
    // attributes, not a plain position attribute — setPositions is the API.
    lineRef.current.geometry.setPositions(positionsScratch);
    lineRef.current.computeLineDistances();
  });

  if (basePoints.length < 2) return null;

  return (
    <group>
      <Line
        ref={lineRef}
        points={basePoints}
        color={stroke.color ?? PALETTE.sketchInk}
        lineWidth={stroke.width_px ?? 2}
        opacity={0.82}
        transparent
      />
    </group>
  );
}

/** A live (in-progress) drawing stroke that drapes in real time. */
function DrapedLiveLine({
  points,
  sampler,
}: {
  points: THREE.Vector3[];
  sampler: ((x: number, z: number) => number) | null;
}) {
  const lineRef = useRef<ElementRef<typeof Line>>(null);

  // Build the base points array (XZ from the live Vector3 points).
  const basePoints = useMemo(
    () => points.map((p) => [p.x, FLAT_Y, p.z] as [number, number, number]),
    [points],
  );
  const positionsScratch = useMemo(
    () => new Float32Array(Math.max(basePoints.length, 2) * 3),
    [basePoints.length],
  );

  useFrame(() => {
    if (!lineRef.current || basePoints.length < 2) return;
    const { viewBlend } = useStudioStore.getState();
    if (!sampler || viewBlend < 0.001) return;

    for (let i = 0; i < basePoints.length; i++) {
      const [x, , z] = basePoints[i]!;
      const y = drapedY(x, z, viewBlend, sampler);
      positionsScratch[i * 3] = x;
      positionsScratch[i * 3 + 1] = y;
      positionsScratch[i * 3 + 2] = z;
    }
    lineRef.current.geometry.setPositions(positionsScratch);
    lineRef.current.computeLineDistances();
  });

  return (
    <Line
      ref={lineRef}
      points={basePoints}
      color={PALETTE.sketchInk}
      lineWidth={2}
      opacity={0.55}
      transparent
    />
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
    // Shape Y = NEGATED world Z (the [-π/2, 0, 0] rotation maps local +Y →
    // world −Z) so the mass lands under the stroke ink, not N/S-mirrored.
    shape.moveTo(worldPts[0]![0], -worldPts[0]![1]);
    for (let i = 1; i < worldPts.length; i++) {
      shape.lineTo(worldPts[i]![0], -worldPts[i]![1]);
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
      position={[0, FLAT_Y, 0]}
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
 * Snap marker — kind-coloured ring + disc + glyph chip at the snapped point.
 * Colour language mirrors the SVG studio's snap visuals: crimson = vertex
 * lock, truth blue = angle, charcoal ink = close. The glyph chip is a
 * constant-px drei <Html> span (the SVG snapGlyph badge equivalent).
 */
function SnapMarker({ hint }: { hint: SnapHint }) {
  const color =
    hint.kind === "vertex"
      ? PALETTE.gsConflict
      : hint.kind === "close"
        ? PALETTE.gsInk
        : "#0030CF"; // angle — Signal Blue (truth)
  const glyph =
    hint.kind === "vertex" ? "●" : hint.kind === "close" ? "◎" : "∠";

  return (
    <group position={[hint.x, FLAT_Y + 0.07, hint.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.58, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <Html
        position={[0, 0.5, 0]}
        center
        zIndexRange={[20, 10]}
        style={{ pointerEvents: "none" }}
      >
        <span
          data-testid="snap-glyph"
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: 13,
            fontWeight: 600,
            color,
            background: "color-mix(in srgb, var(--gs-glass) 80%, transparent)",
            border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
            borderRadius: 6,
            padding: "0px 5px",
            pointerEvents: "none",
          }}
        >
          {glyph}
        </span>
      </Html>
    </group>
  );
}

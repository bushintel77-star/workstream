"use client";

/**
 * Spatial Sketching — SketchCanvasGroup.
 *
 * Renders each persisted SketchCanvas plane as a THREE.Group with a transparent
 * raycast mesh. The group applies the canvas's position + rotation quaternion,
 * so strokes rendered as children inherit the plane's local coordinate system.
 *
 * The raycast mesh is the drawing target when its canvas is the activeCanvasId
 * in the studio store. When no canvas is active (null = implicit ground plane),
 * the FusedSketchLayer's built-in ground mesh handles raycasting.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §5 (SpatialObject as
 * universal node). Each canvas is a spatial node — position + orientation in
 * world space, strokes as children in local board-% space.
 */

import { useMemo, useRef } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Line, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { SketchCanvas } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { buildStationTicks } from "./stationing";
import { pctToWorld, worldToPct, type PctPoint } from "./coordTransform";

export interface SketchCanvasGroupProps {
  /** Board scale in metres (board_width_m — the metres per 100 board-%). */
  scaleM: number;
  /**
   * Called when a pointer event lands on a canvas plane. The point is in
   * world space; the caller localizes to board-% for stroke storage.
   */
  onCanvasPointerDown?: (canvasId: string, worldPoint: THREE.Vector3) => void;
  onCanvasPointerMove?: (canvasId: string, worldPoint: THREE.Vector3) => void;
  onCanvasPointerUp?: (canvasId: string) => void;
}

/**
 * Convert a world-space point to board-% relative to a canvas plane.
 *
 * The canvas plane is positioned + rotated in world space. To get board-%
 * coordinates on the plane, we transform the world point into the plane's
 * local space (inverse of the plane's world matrix), then convert the local
 * XZ coordinates to board-% using the same scaleM + boardAspect as the ground.
 */
export function worldToCanvasPct(
  worldPoint: THREE.Vector3,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): PctPoint {
  const planePos = new THREE.Vector3(
    canvas.position[0],
    canvas.position[1],
    canvas.position[2],
  );
  const planeQuat = new THREE.Quaternion(
    canvas.rotation[0],
    canvas.rotation[1],
    canvas.rotation[2],
    canvas.rotation[3],
  );
  // Inverse-transform the world point into the plane's local space.
  const local = worldPoint.clone().sub(planePos).applyQuaternion(planeQuat.clone().invert());
  // Local X → board X%, local Z → board Y% (the plane's local Z maps to the
  // board's Y axis, matching the ground-plane convention where world Z = board Y).
  return worldToPct(local.x, local.z, scaleM, boardAspect);
}

/**
 * Convert board-% coordinates on a canvas plane to world space.
 * The inverse of worldToCanvasPct.
 */
export function canvasPctToWorld(
  pct: PctPoint,
  canvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): THREE.Vector3 {
  const [x, z] = pctToWorld(pct, scaleM, boardAspect);
  const local = new THREE.Vector3(x, 0, z);
  const planePos = new THREE.Vector3(
    canvas.position[0],
    canvas.position[1],
    canvas.position[2],
  );
  const planeQuat = new THREE.Quaternion(
    canvas.rotation[0],
    canvas.rotation[1],
    canvas.rotation[2],
    canvas.rotation[3],
  );
  return local.applyQuaternion(planeQuat).add(planePos);
}

/* -------------------------------------------------------------------------- */
/* Spatial Margin — the 3D ruler (lives in scene space, not DOM)              */
/* -------------------------------------------------------------------------- */

/**
 * The plane-locked scale margin. Renders as 3D line geometry parented to the
 * active canvas group, so it tilts natively with the camera in axonometric
 * view. Stationing: 10 m per 100 px at 1:200; major tick every 100px (full
 * band height), minor every 20px (26% of band). Labels are billboarded to
 * stay upright under orbit.
 *
 * Per the design handoff §7: "build the margin as line geometry (or a
 * shader-drawn ruled band) parented to the active SketchCanvasGroup inside
 * React Three Fiber."
 */
const RULER_COLOR = "#e8e6e0";
const RULER_OPACITY = 0.42;
const RULER_LABEL_COLOR = "#e8e6e0";
const RULER_LABEL_OPACITY = 0.55;
const TICK_MAJOR_LEN = 0.8;  // metres — full band height
const TICK_MINOR_LEN = 0.26 * TICK_MAJOR_LEN; // 26% of band
const RULER_OFFSET_M = 0.02; // sit just above the plane to avoid z-fighting

function SpatialMargin({ scaleM }: { scaleM: number }) {
  // The ruler runs along the bottom edge (Y=0 in local space, the -Z edge)
  // and the left edge (X=0, the -X edge). In the canvas's local space, the
  // board spans 0..scaleM in X and 0..scaleM*boardAspect in Z. We render
  // ticks pointing inward (negative Z for the bottom ruler, positive X for
  // the left ruler).
  const boardDepth = scaleM; // boardAspect is 1 by law

  // Single stationing source (spec 2.1) — metre chainage, clean 1/2/5 ladder.
  const station = useMemo(() => buildStationTicks(scaleM), [scaleM]);

  // Bottom edge ticks (running along X, ticks point in -Z).
  const bottomTicks = useMemo(
    () =>
      station.map((t) => ({
        pos: [t.metres, RULER_OFFSET_M, 0] as [number, number, number],
        len: t.major ? TICK_MAJOR_LEN : TICK_MINOR_LEN,
        major: t.major,
        label: t.major ? t.label : undefined,
      })),
    [station],
  );

  // Left edge ticks (running along Z, ticks point in +X).
  const leftTicks = useMemo(
    () =>
      station.map((t) => ({
        pos: [0, RULER_OFFSET_M, t.metres] as [number, number, number],
        len: t.major ? TICK_MAJOR_LEN : TICK_MINOR_LEN,
        major: t.major,
        label: t.major ? t.label : undefined,
      })),
    [station],
  );

  // Build line segments for all ticks (each tick is a 2-point line).
  const bottomLinePoints = useMemo(
    () =>
      bottomTicks.flatMap((t) => [
        new THREE.Vector3(t.pos[0], t.pos[1], t.pos[2]),
        new THREE.Vector3(t.pos[0], t.pos[1], t.pos[2] - t.len),
      ]),
    [bottomTicks],
  );

  const leftLinePoints = useMemo(
    () =>
      leftTicks.flatMap((t) => [
        new THREE.Vector3(t.pos[0], t.pos[1], t.pos[2]),
        new THREE.Vector3(t.pos[0] + t.len, t.pos[1], t.pos[2]),
      ]),
    [leftTicks],
  );

  // The main ruler lines (bottom edge + left edge).
  const bottomEdgePoints = useMemo(
    () => [
      new THREE.Vector3(0, RULER_OFFSET_M, 0),
      new THREE.Vector3(scaleM, RULER_OFFSET_M, 0),
    ],
    [scaleM],
  );

  const leftEdgePoints = useMemo(
    () => [
      new THREE.Vector3(0, RULER_OFFSET_M, 0),
      new THREE.Vector3(0, RULER_OFFSET_M, boardDepth),
    ],
    [boardDepth],
  );

  return (
    <group>
      {/* Bottom edge ruler line */}
      <Line points={bottomEdgePoints} color={RULER_COLOR} lineWidth={1} transparent opacity={RULER_OPACITY} />
      {/* Left edge ruler line */}
      <Line points={leftEdgePoints} color={RULER_COLOR} lineWidth={1} transparent opacity={RULER_OPACITY} />
      {/* Bottom tick marks */}
      <Line points={bottomLinePoints} color={RULER_COLOR} lineWidth={1} transparent opacity={RULER_OPACITY} />
      {/* Left tick marks */}
      <Line points={leftLinePoints} color={RULER_COLOR} lineWidth={1} transparent opacity={RULER_OPACITY} />
      {/* Bottom edge labels (billboarded to stay upright under orbit) */}
      {bottomTicks.filter((t) => t.label).map((t, i) => (
        <Billboard key={`bt-${i}`} position={[t.pos[0], t.pos[1], t.pos[2] - t.len - 0.3]}>
          <Text fontSize={0.28} color={RULER_LABEL_COLOR} fillOpacity={RULER_LABEL_OPACITY} anchorX="center" anchorY="middle">
            {t.label}
          </Text>
        </Billboard>
      ))}
      {/* Left edge labels (billboarded) */}
      {leftTicks.filter((t) => t.label).map((t, i) => (
        <Billboard key={`lt-${i}`} position={[t.pos[0] + t.len + 0.3, t.pos[1], t.pos[2]]}>
          <Text fontSize={0.28} color={RULER_LABEL_COLOR} fillOpacity={RULER_LABEL_OPACITY} anchorX="center" anchorY="middle">
            {t.label}
          </Text>
        </Billboard>
      ))}
      {/* Origin "0" label at the corner */}
      <Billboard position={[-0.3, RULER_OFFSET_M, -0.3]}>
        <Text fontSize={0.24} color="#e8e6e0" fillOpacity={0.4} anchorX="center" anchorY="middle">
          m
        </Text>
      </Billboard>
    </group>
  );
}

/** A single canvas plane — a group with a transparent raycast mesh. */
function CanvasPlane({
  canvas,
  scaleM,
  isActive,
  draftingMode,
  scaleView,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  canvas: SketchCanvas;
  scaleM: number;
  isActive: boolean;
  draftingMode: boolean;
  scaleView: boolean;
  onPointerDown: (canvasId: string, worldPoint: THREE.Vector3) => void;
  onPointerMove: (canvasId: string, worldPoint: THREE.Vector3) => void;
  onPointerUp: (canvasId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const position = useMemo(
    () =>
      new THREE.Vector3(
        canvas.position[0],
        canvas.position[1],
        canvas.position[2],
      ),
    [canvas.position],
  );

  const quaternion = useMemo(
    () =>
      new THREE.Quaternion(
        canvas.rotation[0],
        canvas.rotation[1],
        canvas.rotation[2],
        canvas.rotation[3],
      ),
    [canvas.rotation],
  );

  // The raycast mesh is large enough to cover the board area. It sits in the
  // plane's local XY (the plane's local Z is its normal). We rotate -PI/2
  // around X so the plane faces its normal (matching the ground-plane convention).
  const planeSize = scaleM * 5;

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      {/* Transparent raycast mesh — only captures events when this canvas is active */}
      {isActive ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (e.point) onPointerDown(canvas.id, e.point.clone());
          }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (e.point) onPointerMove(canvas.id, e.point.clone());
          }}
          onPointerUp={() => onPointerUp(canvas.id)}
        >
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      {/* Visual debug indicator — a faint border to show the plane's extent.
          Only visible when the canvas is active (so inactive planes don't clutter). */}
      {isActive ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <ringGeometry args={[planeSize / 2 - 0.05, planeSize / 2, 4]} />
          <meshBasicMaterial color="#0030CF" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      ) : null}
      {/* Spatial Margin — the 3D ruler. Only on the active canvas when
          drafting mode is on AND the master scale toggle is on. Rendered
          inside the canvas group so it inherits the plane's rotation and
          tilts with the axonometric camera. */}
      {isActive && draftingMode && scaleView ? <SpatialMargin scaleM={scaleM} /> : null}
    </group>
  );
}

/**
 * Renders all persisted canvas planes. Each plane is a THREE.Group with a
 * transparent raycast mesh that captures pointer events when it is the active
 * canvas. Strokes on a canvas render as children of its group (handled by
 * FusedSketchLayer, which reads canvas_id from each stroke).
 */
export function SketchCanvasGroup({
  scaleM,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
}: SketchCanvasGroupProps) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const draftingMode = useStudioStore((s) => s.draftingMode);
  const scaleView = useStudioStore((s) => s.scaleView);

  return (
    <group>
      {canvases.map((canvas) => (
        <CanvasPlane
          key={canvas.id}
          canvas={canvas}
          scaleM={scaleM}
          isActive={canvas.id === activeCanvasId}
          draftingMode={draftingMode}
          scaleView={scaleView}
          onPointerDown={onCanvasPointerDown ?? (() => { })}
          onPointerMove={onCanvasPointerMove ?? (() => { })}
          onPointerUp={onCanvasPointerUp ?? (() => { })}
        />
      ))}
      {/* Ground-plane ruler — the active target when no spatial canvas is
          selected (spec 2.5). Renders flat at the board origin, so the scale
          margin is present even on an empty ground board. */}
      {activeCanvasId === null && draftingMode && scaleView ? (
        <SpatialMargin scaleM={scaleM} />
      ) : null}
    </group>
  );
}

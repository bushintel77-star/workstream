"use client";

/**
 * Spatial Sketching — Stroke Transfer (Phase 2).
 *
 * Projects a stroke from one canvas plane onto another via a forward
 * perspective projection from the camera. The flow:
 *
 * 1. The operator arms the transfer tool (toggle in FloatingChrome or a
 *    keyboard shortcut).
 * 2. Click a committed stroke — it becomes the transfer source (highlighted).
 * 3. Click a canvas plane (or a depth-rail cell) — it becomes the target.
 * 4. For each point on the source stroke:
 *    a. Convert the point from the source canvas's board-% space to world space.
 *    b. Project the world point to NDC (Normalized Device Coordinates) using
 *       the camera's projection matrix.
 *    c. Cast a ray from the camera through the NDC point.
 *    d. Intersect the ray with the target canvas's plane (defined by the
 *       canvas's position + rotation).
 *    e. Convert the intersection point to the target canvas's board-% space.
 * 5. Save the projected points as a new stroke on the target canvas.
 *
 * The math: the ray-plane intersection uses THREE.Raycaster.setFromCamera
 * (which accounts for the fused camera's projection matrix) and
 * THREE.Plane.setFromNormalAndCoplanarPoint (which defines the target canvas's
 * plane from its normal + position). The result is a stroke that appears to
 * be "projected through" the camera onto the target plane — exactly what
 * Mental Canvas does when you transfer a sketch from one layer to another.
 */

import { useMemo, useCallback } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CanvasStroke, SketchCanvas } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { canvasPctToWorld, worldToCanvasPct } from "./SketchCanvasGroup";
import { pctToWorld } from "./coordTransform";

/** The ground plane as a SketchCanvas-like object (for uniform handling). */
const GROUND_CANVAS: SketchCanvas = {
  id: "__ground__",
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  season_tag: "ALL",
};

/**
 * Project a single world-space point through the camera onto a target canvas
 * plane, returning the target canvas's board-% coordinates.
 *
 * This is the core of the forward perspective projection:
 *   1. Project the world point to NDC.
 *   2. Cast a ray from the camera through the NDC point.
 *   3. Intersect the ray with the target canvas's plane.
 *   4. Convert the intersection to the target canvas's board-% space.
 */
function projectPointToCanvas(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  targetCanvas: SketchCanvas,
  scaleM: number,
  boardAspect: number,
): { x: number; y: number } | null {
  // Step 1: Project the world point to NDC.
  const ndc = worldPoint.clone().project(camera);

  // Step 2: Cast a ray from the camera through the NDC point.
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);

  // Step 3: Define the target canvas's plane.
  // The plane's normal is the canvas's local Y-axis (up from the plane
  // surface), rotated by the canvas's quaternion. The plane passes through
  // the canvas's position.
  const planeNormal = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion(
    targetCanvas.rotation[0],
    targetCanvas.rotation[1],
    targetCanvas.rotation[2],
    targetCanvas.rotation[3],
  );
  planeNormal.applyQuaternion(quat);
  const planePoint = new THREE.Vector3(
    targetCanvas.position[0],
    targetCanvas.position[1],
    targetCanvas.position[2],
  );
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);

  // Step 4: Intersect the ray with the plane.
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;

  // Step 5: Convert the hit point to the target canvas's board-% space.
  return worldToCanvasPct(hit, targetCanvas, scaleM, boardAspect);
}

/**
 * Transfer a stroke from one canvas to another via camera projection.
 * Returns the new stroke (with canvas_id set to the target), or null if
 * the projection failed (e.g. a point is behind the camera or parallel
 * to the target plane).
 */
export function transferStroke(
  stroke: CanvasStroke,
  sourceCanvas: SketchCanvas | null,
  targetCanvas: SketchCanvas,
  camera: THREE.Camera,
  scaleM: number,
  boardAspect: number,
): CanvasStroke | null {
  // Convert each source board-% point to world space, then project through
  // the camera onto the target canvas.
  const projectedPoints: { x_pct: number; y_pct: number }[] = [];
  for (const pt of stroke.points ?? []) {
    // Source canvas: use canvasPctToWorld if the stroke has a canvas_id,
    // otherwise use the ground-plane pctToWorld.
    const worldPt = sourceCanvas
      ? canvasPctToWorld({ x: pt.x_pct, y: pt.y_pct }, sourceCanvas, scaleM, boardAspect)
      : new THREE.Vector3(...pctToWorld({ x: pt.x_pct, y: pt.y_pct }, scaleM, boardAspect), 0);

    const projected = projectPointToCanvas(worldPt, camera, targetCanvas, scaleM, boardAspect);
    if (!projected) return null;
    projectedPoints.push({ x_pct: projected.x, y_pct: projected.y });
  }

  if (projectedPoints.length < 2) return null;

  return {
    id: crypto.randomUUID(),
    points: projectedPoints,
    color: stroke.color,
    width_px: stroke.width_px,
    kind: stroke.kind ?? "ink",
    nib: stroke.nib,
    canvas_id: targetCanvas.id === GROUND_CANVAS.id ? null : targetCanvas.id,
    extrude_height_m: stroke.extrude_height_m,
  };
}

/** Resolve a SketchCanvas by id, or return the ground plane sentinel. */
function resolveCanvas(
  id: string | null,
  canvases: SketchCanvas[],
): SketchCanvas {
  if (id === null) return GROUND_CANVAS;
  return canvases.find((c) => c.id === id) ?? GROUND_CANVAS;
}

/**
 * The transfer interaction layer. Renders as an invisible overlay that
 * captures clicks when the transfer tool is armed. Self-gates on
 * transferToolArmed — when disarmed, it renders nothing.
 */
export function StrokeTransferLayer({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const { camera } = useThree();
  const transferToolArmed = useStudioStore((s) => s.transferToolArmed);
  const transferSourceStrokeId = useStudioStore((s) => s.transferSourceStrokeId);
  const setTransferSourceStrokeId = useStudioStore((s) => s.setTransferSourceStrokeId);
  const setTransferToolArmed = useStudioStore((s) => s.setTransferToolArmed);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const addSketchStroke = useStudioStore((s) => s.addSketchStroke);

  // The source stroke (if selected).
  const sourceStroke = useMemo(
    () => strokes.find((s) => s.id === transferSourceStrokeId) ?? null,
    [strokes, transferSourceStrokeId],
  );

  // The target canvas is the active canvas (the operator selects it via the
  // depth rail before clicking to confirm the transfer).
  const targetCanvas = resolveCanvas(activeCanvasId, canvases);

  // Click handler: if no source is selected, pick the clicked stroke.
  // If a source is already selected, perform the transfer to the active canvas.
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!transferToolArmed) return;
      e.stopPropagation();

      if (!sourceStroke) {
        // Phase 1: select the source stroke.
        // Raycast to find which stroke was clicked (point-in-polygon test).
        const pt = e.point;
        if (!pt) return;
        const hit = strokes.find((s) => {
          const sourceCanvas = resolveCanvas(s.canvas_id ?? null, canvases);
          const pts = (s.points ?? []).map((p) =>
            canvasPctToWorld({ x: p.x_pct, y: p.y_pct }, sourceCanvas, scaleM, boardAspect),
          );
          return pts.length >= 3 && pointInPolygonXZ(pt, pts);
        });
        if (hit) {
          setTransferSourceStrokeId(hit.id);
        }
        return;
      }

      // Phase 2: perform the transfer to the active canvas.
      const sourceCanvas = resolveCanvas(sourceStroke.canvas_id ?? null, canvases);
      // Don't transfer to the same canvas.
      if (sourceCanvas.id === targetCanvas.id) return;

      const newStroke = transferStroke(
        sourceStroke,
        sourceCanvas.id === GROUND_CANVAS.id ? null : sourceCanvas,
        targetCanvas,
        camera,
        scaleM,
        boardAspect,
      );
      if (newStroke) {
        addSketchStroke(newStroke);
      }
      // Reset the transfer state.
      setTransferSourceStrokeId(null);
      setTransferToolArmed(false);
    },
    [
      transferToolArmed,
      sourceStroke,
      strokes,
      canvases,
      targetCanvas,
      camera,
      scaleM,
      boardAspect,
      setTransferSourceStrokeId,
      setTransferToolArmed,
      addSketchStroke,
    ],
  );

  if (!transferToolArmed) return null;

  // Render a large invisible plane that captures clicks across the viewport.
  const planeSize = scaleM * 5;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerDown={onPointerDown}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Point-in-polygon test in the XZ plane (Y is ignored). */
function pointInPolygonXZ(point: THREE.Vector3, polygon: THREE.Vector3[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const zi = polygon[i]!.z;
    const xj = polygon[j]!.x;
    const zj = polygon[j]!.z;
    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

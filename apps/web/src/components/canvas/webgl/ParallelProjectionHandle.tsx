"use client";

/**
 * Spatial Sketching — Parallel Projection Handle (Mental Canvas roadmap,
 * Phase A1).
 *
 * The Mental Canvas mechanic for adjusting a flat plane: drag along one
 * axis (their app: depth; ours: height, since flat planes stack in Z).
 * Modeled directly on PlacementGizmo.tsx's begin/transient/end undo split
 * (one history entry per whole drag, no history spam per frame) and its
 * drei <TransformControls> mounting pattern — constrained to the Y axis
 * only via showX/showZ, since Parallel Projection never rotates.
 *
 * Renders only while adjustingCanvasId names a FLAT plane (angle 0). A
 * standing plane's fold is HingeProjectionGizmo's job (Phase A2), not
 * this component's.
 */

import { useEffect, useRef } from "react";
import type { Event as ThreeEvent, Object3D } from "three";
import { TransformControls } from "@react-three/drei";
import { useStudioStore } from "./studioStore";

/** The three-stdlib TransformControls surface read after a drag tick. */
interface GizmoControl {
  object?: Object3D;
}

/** A plane is "flat" for this handle's purposes when its rotation is the
 *  identity quaternion (or close enough — presets/fold math always land
 *  exactly on identity for angle 0, but guard against float drift). */
function isFlat(rotation: readonly [number, number, number, number]): boolean {
  const [x, y, z, w] = rotation;
  return Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4 && Math.abs(z) < 1e-4 && Math.abs(w - 1) < 1e-4;
}

export function ParallelProjectionHandle() {
  const adjustingCanvasId = useStudioStore((s) => s.adjustingCanvasId);
  const setAdjustingCanvasId = useStudioStore((s) => s.setAdjustingCanvasId);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const sketchCanvases = useStudioStore((s) => s.sketchCanvases);
  const beginTransform = useStudioStore((s) => s.beginSketchCanvasTransform);
  const setTransient = useStudioStore((s) => s.setSketchCanvasTransformTransient);
  const endTransform = useStudioStore((s) => s.endSketchCanvasTransform);

  const draggingStarted = useRef(false);

  // Dismiss the handle the moment focus moves to a different plane (or
  // ground) — a stale gizmo hanging off a plane the operator isn't looking
  // at anymore is worse than requiring them to reopen the placement flyout.
  useEffect(() => {
    if (adjustingCanvasId && activeCanvasId !== adjustingCanvasId) {
      setAdjustingCanvasId(null);
    }
  }, [activeCanvasId, adjustingCanvasId, setAdjustingCanvasId]);

  useEffect(() => {
    if (!adjustingCanvasId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdjustingCanvasId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjustingCanvasId, setAdjustingCanvasId]);

  const canvas = adjustingCanvasId
    ? sketchCanvases.find((c) => c.id === adjustingCanvasId)
    : undefined;

  if (!canvas || !isFlat(canvas.rotation)) return null;

  const [x, y, z] = canvas.position;

  const handleObjectChange = (e?: ThreeEvent) => {
    const control = e?.target as GizmoControl | undefined;
    const obj = control?.object;
    if (!obj) return;
    if (!draggingStarted.current) {
      beginTransform();
      draggingStarted.current = true;
    }
    setTransient(canvas.id, { position: [x, obj.position.y, z] });
  };

  return (
    <TransformControls
      mode="translate"
      position={[x, y, z]}
      showX={false}
      showZ={false}
      translationSnap={0.1}
      onObjectChange={handleObjectChange}
      onMouseDown={() => {
        draggingStarted.current = false;
      }}
      onMouseUp={() => {
        endTransform();
      }}
    />
  );
}

"use client";

/**
 * Spatial Sketching — Hinge Projection Gizmo (Mental Canvas roadmap,
 * Phase A2).
 *
 * The fold gesture: drag to rotate a plane from 0° (flat) to 90° (fully
 * standing) around its own hinge line (the bearing chosen at placement).
 * Mental Canvas's own version morphs the handle's shape at named angles —
 * octagon 45° / hexagon 60° / pentagon 72° / square 90° — as a physical
 * confirmation the fold has hit a "real" architectural angle rather than
 * an arbitrary in-between one. This component reproduces that glyph morph
 * (a low-segment-count circleGeometry IS a regular polygon — no separate
 * mesh per shape needed) plus a live angle/bearing readout.
 *
 * Mechanism: drei <TransformControls mode="rotate" space="local">, only
 * the local X ring shown, wraps a <group> seeded with the plane's CURRENT
 * quaternion (not left to TransformControls' own identity default — a
 * fold must start from wherever the plane already is, including
 * mid-fold). Because same-axis rotations compose additively, a pure
 * local-X drag from that seed always stays inside the
 * `Ry(bearing) * Rx(-angle)` family with bearing fixed — captured once at
 * mount via canvasPlacement.ts's decomposeFoldQuaternion, then
 * angleFromQuaternionAtBearing reads the live angle back each tick (see
 * that module's doc comments for the full derivation + round-trip tests).
 *
 * Renders only for a NON-flat adjusting plane — a flat one is
 * ParallelProjectionHandle's job (height-only, Phase A1).
 */

import { useEffect, useRef, useState } from "react";
import type { Event as ThreeEvent, Object3D } from "three";
import * as THREE from "three";
import { TransformControls, Billboard, Text } from "@react-three/drei";
import { useStudioStore } from "./studioStore";
import {
  angleFromQuaternionAtBearing,
  decomposeFoldQuaternion,
  clampFoldAngle,
  foldQuaternion,
  nearestSnap,
  type SnapGlyph,
} from "./canvasPlacement";

interface GizmoControl {
  object?: Object3D;
}

function isFlat(rotation: readonly [number, number, number, number]): boolean {
  const [x, y, z, w] = rotation;
  return Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4 && Math.abs(z) < 1e-4 && Math.abs(w - 1) < 1e-4;
}

/** A low-segment circleGeometry renders as a regular polygon — the exact
 *  octagon/hexagon/pentagon/square morph the spec describes, without a
 *  separate mesh per shape. A mid-fold (no snap) shows a plain ring. */
function SnapGlyphMesh({
  position,
  snap,
}: {
  position: readonly [number, number, number];
  snap: SnapGlyph | null;
}) {
  const sides = snap?.sides ?? 24;
  const color = snap ? "#8fd18f" : "#e8e6e0";
  return (
    <Billboard position={position}>
      <mesh>
        <ringGeometry args={[0.16, 0.2, sides]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

export function HingeProjectionGizmo() {
  const adjustingCanvasId = useStudioStore((s) => s.adjustingCanvasId);
  const setAdjustingCanvasId = useStudioStore((s) => s.setAdjustingCanvasId);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const sketchCanvases = useStudioStore((s) => s.sketchCanvases);
  const beginTransform = useStudioStore((s) => s.beginSketchCanvasTransform);
  const setTransient = useStudioStore((s) => s.setSketchCanvasTransformTransient);
  const endTransform = useStudioStore((s) => s.endSketchCanvasTransform);

  const draggingStarted = useRef(false);
  const bearingRef = useRef(0);
  const [liveAngle, setLiveAngle] = useState(0);
  const [liveSnap, setLiveSnap] = useState<SnapGlyph | null>(null);

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

  // Seed bearing + the initial readout from wherever this plane already
  // is (including mid-fold) whenever the target plane's identity changes
  // — never re-seeds mid-drag off the gizmo's own live output.
  useEffect(() => {
    if (!canvas) return;
    const q = new THREE.Quaternion(...canvas.rotation);
    const { angleDeg, bearingDeg } = decomposeFoldQuaternion(q);
    bearingRef.current = bearingDeg;
    setLiveAngle(angleDeg);
    setLiveSnap(nearestSnap(angleDeg));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed on plane identity only
  }, [canvas?.id]);

  if (!canvas || isFlat(canvas.rotation)) return null;

  const [x, y, z] = canvas.position;
  const seedQuat = new THREE.Quaternion(...canvas.rotation);

  const handleObjectChange = (e?: ThreeEvent) => {
    const control = e?.target as GizmoControl | undefined;
    const obj = control?.object;
    if (!obj) return;
    if (!draggingStarted.current) {
      beginTransform();
      draggingStarted.current = true;
    }
    const rawAngle = angleFromQuaternionAtBearing(obj.quaternion, bearingRef.current);
    const clamped = clampFoldAngle(rawAngle);
    const snap = nearestSnap(clamped);
    const finalAngle = snap ? snap.angleDeg : clamped;
    const q = foldQuaternion(finalAngle, bearingRef.current);
    setTransient(canvas.id, { rotation: [q.x, q.y, q.z, q.w] });
    setLiveAngle(finalAngle);
    setLiveSnap(snap);
  };

  return (
    <>
      <TransformControls
        mode="rotate"
        space="local"
        showY={false}
        showZ={false}
        onObjectChange={handleObjectChange}
        onMouseDown={() => {
          draggingStarted.current = false;
        }}
        onMouseUp={() => {
          endTransform();
        }}
      >
        <group
          position={[x, y, z]}
          quaternion={[seedQuat.x, seedQuat.y, seedQuat.z, seedQuat.w]}
        />
      </TransformControls>

      <SnapGlyphMesh position={[x, y + 0.6, z]} snap={liveSnap} />

      <Billboard position={[x, y + 0.9, z]}>
        <Text
          fontSize={0.18}
          color="#e8e6e0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#131517"
        >
          {`${liveAngle.toFixed(0)}° · bearing ${bearingRef.current.toFixed(0)}°`}
        </Text>
      </Billboard>
    </>
  );
}

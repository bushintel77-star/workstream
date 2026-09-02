"use client";

/**
 * Spatial Sketching — Bird's-Eye HUD (Mental Canvas roadmap, Phase A3).
 *
 * The secondary mini-viewport shown while a sketch plane is being placed:
 * a fixed overhead frame carrying the site silhouette, the main camera's
 * view frustum, and the plane currently under the gizmo. Placement drags
 * (A1's height drag, A2's fold) ask the operator to judge where a plane
 * sits and which way it faces from inside the very viewport they are
 * manipulating — this is the outside view that makes that readable.
 *
 * ARCHITECTURE — its own <Canvas>, deliberately.
 * Not a scissored viewport and not a drei <Hud> share of the main canvas:
 * SplitViewLens.tsx's header explains why (the post-FX EffectComposer takes
 * over the render loop, and a scissored single canvas fights it). Split
 * view already mounts two full studios for the same reason; this one is
 * small and carries no composer, no Environment, no shadows.
 *
 * The two canvases therefore share no React state — they meet only at the
 * zustand store (GOLD-STANDARD-2026-ARCHITECTURE.md §5). The main camera's
 * pose arrives through the transient _liveCameraPosition channel FusedCamera
 * writes every frame, read here via getState() inside this canvas's own
 * useFrame: no subscription, no React render per frame, and the wireframes
 * are rewritten in pre-allocated buffers rather than rebuilt.
 *
 * The geometry itself lives in birdsEyeFrustum.ts so it can be unit-tested
 * (nothing in apps/web mounts an R3F canvas in jsdom).
 *
 * The mini-viewport is deliberately NOT interactive — a second orbit
 * surface would fight the drag already in progress. Its view buttons
 * re-aim the MAIN camera, through the same setCameraPreset action and the
 * same four presets CameraDock uses, so pressing one changes the view the
 * fold is actually being judged in.
 */

import { useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { easeInOutCubic, useStudioStore, type CameraPreset } from "./studioStore";
import { pitchRadians } from "./cameraRig";
import { pctToWorld } from "./coordTransform";
import { decomposeFoldQuaternion } from "./canvasPlacement";
import {
  FRUSTUM_VERTEX_COUNT,
  HUD_CAMERA_UP,
  MAIN_CAMERA_FOV_DEG,
  PLANE_OUTLINE_VERTEX_COUNT,
  hudFraming,
  hudPlaneExtentM,
  mainCameraUp,
  writeFrustumSegments,
  writePlaneOutlineSegments,
  type HudFraming,
} from "./birdsEyeFrustum";
import styles from "./BirdsEyeHud.module.css";

/** How far down the view axis the frustum wedge is drawn, as a fraction of
 *  the lot's long side. The real far plane (500 m) would draw a wedge many
 *  times the size of the site. */
const FRUSTUM_DEPTH_FACTOR = 0.9;

/** The same four canonical views as the camera dock (handoff §6.1), driving
 *  the same store action. Labels only — the dock owns the glyphs. */
const HUD_VIEWS: readonly { preset: CameraPreset; label: string }[] = [
  { preset: "plan", label: "Plan" },
  { preset: "axo", label: "Axo" },
  { preset: "sec", label: "Sec" },
  { preset: "3d", label: "3D" },
];

const SILHOUETTE_COLOUR = "#7d8a94";
const FRUSTUM_COLOUR = "#d8b25c";
const PLANE_COLOUR = "#8fd18f";

export interface BirdsEyeHudProps {
  scaleM: number;
  boardAspect: number;
}

/**
 * The main viewport's aspect ratio, measured from the real canvas element
 * (the HUD's own canvas has no idea how big the studio is). Re-measured on
 * resize; the HUD only lives for the length of a drag, so this is a cheap
 * listener rather than a per-frame DOM read.
 */
function useMainViewportAspect(): number {
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLCanvasElement>(
        '[data-testid="webgl-canvas"]',
      );
      const width = el?.clientWidth ?? window.innerWidth;
      const height = el?.clientHeight ?? window.innerHeight;
      if (width > 0 && height > 0) setAspect(width / height);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return aspect;
}

/** Pre-allocated line geometry, disposed with the component. */
function useSegmentGeometry(vertexCount: number): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3),
    );
    return g;
  }, [vertexCount]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function positionsOf(geometry: THREE.BufferGeometry): {
  attribute: THREE.BufferAttribute;
  array: Float32Array;
} {
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  return { attribute, array: attribute.array as Float32Array };
}

/**
 * Fixed overhead orthographic camera. Set imperatively rather than through
 * <Canvas camera={...}> so the up vector is applied BEFORE the look-at —
 * north stays at the top of the mini-viewport, matching the main plan view.
 */
function HudCamera({ framing }: { framing: HudFraming }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    camera.up.set(...HUD_CAMERA_UP);
    camera.position.set(0, framing.cameraHeightM, 0);
    camera.near = 0.1;
    camera.far = framing.farM;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = framing.zoom;
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera, framing]);

  return null;
}

/** The site's title boundary, flat at ground level — the fixed reference
 *  everything else in the HUD is read against. */
function SiteSilhouette({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const boundary = useStudioStore((s) => s.siteBoundary);

  const geometry = useMemo(() => {
    const points = boundary.map((pct) => {
      const [x, z] = pctToWorld(pct, scaleM, boardAspect);
      return new THREE.Vector3(x, 0, z);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [boundary, scaleM, boardAspect]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (boundary.length < 2) return null;
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={SILHOUETTE_COLOUR} transparent opacity={0.8} />
    </lineLoop>
  );
}

/** The main camera's view frustum, rewritten every frame from the store's
 *  transient pose channel. */
function CameraFrustum({ depthM, aspect }: { depthM: number; aspect: number }) {
  const geometry = useSegmentGeometry(FRUSTUM_VERTEX_COUNT);

  useFrame(() => {
    const { _liveCameraPosition: pose, liveRig, viewBlend } = useStudioStore.getState();
    const { attribute, array } = positionsOf(geometry);
    writeFrustumSegments(
      pose,
      {
        fovDeg: MAIN_CAMERA_FOV_DEG,
        aspect,
        depthM,
        // The rig's own eased tilt, so the wedge rolls exactly as the main
        // camera does through the ortho-to-perspective blend.
        up: mainCameraUp(
          liveRig.rotateDeg,
          pitchRadians(liveRig.tiltDeg) * easeInOutCubic(viewBlend),
        ),
      },
      array,
    );
    attribute.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={FRUSTUM_COLOUR} transparent opacity={0.9} />
    </lineSegments>
  );
}

/** The plane under the gizmo. Read per frame rather than from props: the
 *  drag writes its pose through setSketchCanvasTransformTransient, and the
 *  HUD should track it tick for tick. */
function PlaneFrame({ extentM }: { extentM: number }) {
  const geometry = useSegmentGeometry(PLANE_OUTLINE_VERTEX_COUNT);

  useFrame(() => {
    const { adjustingCanvasId, sketchCanvases } = useStudioStore.getState();
    const canvas = sketchCanvases.find((c) => c.id === adjustingCanvasId);
    if (!canvas) return;
    const { attribute, array } = positionsOf(geometry);
    writePlaneOutlineSegments(canvas.position, canvas.rotation, extentM, array);
    attribute.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={PLANE_COLOUR} />
    </lineSegments>
  );
}

/**
 * The plane's name, and its live fold angle + bearing.
 *
 * Its own leaf component on purpose: it subscribes to the canvas array, so
 * a fold drag re-renders this one readout line rather than the panel that
 * owns the <Canvas>. The angle is decomposed here rather than read off the
 * gizmo, since the two components never meet — canvasPlacement.ts's
 * decomposition is the shared source of truth for both.
 */
function PlaneReadout() {
  const adjustingCanvasId = useStudioStore((s) => s.adjustingCanvasId);
  const canvas = useStudioStore((s) =>
    s.sketchCanvases.find((c) => c.id === adjustingCanvasId),
  );
  if (!canvas) return null;

  const { angleDeg, bearingDeg } = decomposeFoldQuaternion(
    new THREE.Quaternion(...canvas.rotation),
  );

  return (
    <div className={styles.readout}>
      <span className={styles.readoutName} title={canvas.label ?? "Unnamed plane"}>
        {canvas.label ?? "Unnamed plane"}
      </span>
      <span className={styles.readoutFigures}>
        {`${angleDeg.toFixed(0)}° · ${bearingDeg.toFixed(0)}°`}
      </span>
    </div>
  );
}

function BirdsEyePanel({ scaleM, boardAspect }: BirdsEyeHudProps) {
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const setCameraPreset = useStudioStore((s) => s.setCameraPreset);
  const handedness = useStudioStore((s) => s.handedness);
  const aspect = useMainViewportAspect();

  const framing = useMemo(
    () => hudFraming(scaleM, boardAspect),
    [scaleM, boardAspect],
  );
  const depthM = useMemo(
    () => Math.max(scaleM, scaleM * boardAspect) * FRUSTUM_DEPTH_FACTOR,
    [scaleM, boardAspect],
  );
  const planeExtentM = useMemo(
    () => hudPlaneExtentM(scaleM, boardAspect),
    [scaleM, boardAspect],
  );

  // Sit opposite the depth rail, the same way the readout group flips.
  const sideClass = handedness === "LEFT" ? styles.hudRight : styles.hudLeft;

  return (
    <div className={`${styles.hud} ${sideClass}`} data-testid="birds-eye-hud">
      <div className={styles.header}>
        <span className={styles.headerLabel}>Bird&rsquo;s eye</span>
        <span className={styles.headerHint}>Placing</span>
      </div>

      <div className={styles.viewport}>
        <Canvas
          orthographic
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ position: "absolute", inset: 0 }}
          data-testid="birds-eye-canvas"
        >
          <HudCamera framing={framing} />
          <SiteSilhouette scaleM={scaleM} boardAspect={boardAspect} />
          <CameraFrustum depthM={depthM} aspect={aspect} />
          <PlaneFrame extentM={planeExtentM} />
        </Canvas>
        {/* North marker — the mini-viewport is always north-up
            (HUD_CAMERA_UP), so this is a fixed label, not a compass. */}
        <span className={styles.north} aria-hidden>
          N
        </span>
      </div>

      <PlaneReadout />

      <div className={styles.views} role="group" aria-label="Camera view">
        {HUD_VIEWS.map((view) => (
          <button
            key={view.preset}
            type="button"
            className={`${styles.viewButton} ${cameraPreset === view.preset ? styles.viewButtonActive : ""}`}
            onClick={() => setCameraPreset(view.preset)}
            data-birds-eye-view={view.preset}
            title={`${view.label} view`}
          >
            {cameraPreset === view.preset && <span className={styles.viewPip} />}
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Gate only. Everything below mounts a second WebGL context, so it exists
 * strictly for the length of a placement drag — the same adjustingCanvasId
 * condition that arms the two gizmos, covering the flat-plane height drag
 * and the standing-plane fold alike.
 */
export function BirdsEyeHud({ scaleM, boardAspect }: BirdsEyeHudProps) {
  const adjustingCanvasId = useStudioStore((s) => s.adjustingCanvasId);
  if (!adjustingCanvasId) return null;
  return <BirdsEyePanel scaleM={scaleM} boardAspect={boardAspect} />;
}

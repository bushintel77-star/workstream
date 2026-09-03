"use client";

/**
 * Gold Standard 2026 — Photo-Trace Plane (the frozen, calibrated camera frame).
 *
 * The photo-trace elevation capstone: a pinned site photo stands as a
 * vertical textured plane in the scene's metre-space, facing the camera at
 * its azimuth. While the session is active:
 *
 *   - the camera flies to the photo's facade rig (φ=90°, the existing blend +
 *     elevation springs crossfade the projection; this fly interpolates the
 *     rig's pan/zoom/azimuth over ~0.7s),
 *   - freehand ink raycasts onto the plane and commits as true-metre
 *     plane-space strokes (trace mode),
 *   - a reference-line drag calibrates the plane against a known real length
 *     (calibrate mode) — the single known dimension scales the whole frame.
 *
 * Interaction notes (hard-won):
 *   - The plane hit is computed from the native event + the live camera with
 *     the pure `rayPlaneHit` math — R3F's internal raycaster delivers a
 *     ~122x-squashed ray against the fused facade projection (its pointer
 *     state and the projection disagree under the custom matrix), so
 *     `e.point` cannot be trusted here.
 *   - Drag state lives in refs only; the live draft line updates its
 *     Line2 buffer imperatively. A React state update inside the drag path
 *     (the first `setLivePoints` implementation) made R3F stop delivering
 *     pointermoves to this mesh — refs keep the drag render-free.
 *
 * The plane only mounts while pinned — the paper canvas stays clean when no
 * photo session is open (GOLD-STANDARD-2026: the drawing is the product).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { PhotoTraceStroke } from "@workstream/contracts";
import {
  collectSnapNodes,
  DEFAULT_STITCH_EPSILON_M,
  type SpatialPoint,
  type SpatialStroke,
} from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { nearestPlaneStrokeId } from "./selectionPick";
import { useReducedMotion } from "./useReducedMotion";
import {
  applyReferenceCalibration,
  lerpRig,
  photoPlaneFromElevation,
  pinRigForPlane,
  planeAxes,
  planeToWorld,
  rescaleStrokes,
  worldToPlane,
  type PhotoPlane,
  type PlanePoint,
} from "./photoTraceMath";

/** Fly duration (seconds) for the pin → facade camera glide. */
const FLY_SECONDS = 0.7;
/** Minimum plane-space distance (metres) between sampled stroke points. */
const MIN_POINT_SPACING_M = 0.02;
/** Live-draft line capacity (plane-space points). */
const MAX_DRAFT_POINTS = 512;

/** Module-level ref so the DOM calibration HUD can invoke the plane's apply. */
export const applyCalibrationRef: { current: (() => void) | null } = {
  current: null,
};

export function PhotoTracePlane({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const session = useStudioStore((s) => s.photoTraceSession);
  const elevation = useStudioStore((s) =>
    session
      ? s.photoElevations.find((e) => e.id === session.elevationId) ?? null
      : null,
  );
  const updatePhotoElevation = useStudioStore((s) => s.updatePhotoElevation);
  const addPhotoTraceStroke = useStudioStore((s) => s.addPhotoTraceStroke);
  const setPhotoCalibrateDraft = useStudioStore((s) => s.setPhotoCalibrateDraft);
  const setPhotoTraceSession = useStudioStore((s) => s.setPhotoTraceSession);
  const toggleSelectRef = useStudioStore((s) => s.toggleSelectRef);
  const selection = useStudioStore((s) => s.selection);
  const selectedStrokeIds = useMemo(
    () =>
      new Set(
        selection
          .filter(
            (r) => r.kind === "photoStroke" && r.elevationId === elevation?.id,
          )
          .map((r) => r.id),
      ),
    [selection, elevation?.id],
  );
  const reducedMotion = useReducedMotion();
  const camera = useThree((s) => s.camera);

  const plane = useMemo(
    () => (elevation ? photoPlaneFromElevation(elevation) : null),
    [elevation],
  );

  // Stitch ε-snap targets — committed plane strokes' welded endpoints lifted
  // into world metres, so the pulsing dots show exactly where a weld will
  // land when the trace cursor enters the snap radius.
  const stitchNodes = useMemo(() => {
    if (!plane || !elevation) return [];
    const spatial: SpatialStroke[] = elevation.strokes.map((s) => ({
      id: s.id,
      points: s.points.map((p) => {
        const w = planeToWorld(plane, { u: p.x_m, v: p.y_m });
        return { x: w.x, y: w.z };
      }),
    }));
    return collectSnapNodes(spatial, DEFAULT_STITCH_EPSILON_M);
  }, [elevation, plane]);
  useEffect(() => {
    useStudioStore.getState().setStitchSnapNodes(stitchNodes);
    return () => {
      // The plane owns the snap set while pinned — release it (and any
      // stale trace hover) on unpin so the ground ink layer re-arms.
      useStudioStore.getState().setStitchSnapNodes([]);
      useStudioStore.getState().setStitchHoverPoint(null);
    };
  }, [stitchNodes]);
  /** Live trace cursor for the ε-snap dots (world metres). */
  const setHover = useCallback((p: SpatialPoint | null) => {
    useStudioStore.getState().setStitchHoverPoint(p);
  }, []);

  // ---- Live trace draft — refs only, rendered imperatively (no React state
  // in the drag path: a re-render here kills R3F's move delivery). ----
  const drawingRef = useRef(false);
  const pointsRef = useRef<PlanePoint[]>([]);
  const draftVersionRef = useRef(0);

  // ---- Fly the camera to the photo's frozen frame on pin ----
  const flyRef = useRef<{
    start: ReturnType<typeof lerpRig>;
    end: ReturnType<typeof lerpRig>;
    t0: number;
  } | null>(null);
  useEffect(() => {
    if (!session || !plane) {
      flyRef.current = null;
      return;
    }
    const store = useStudioStore.getState();
    const target = pinRigForPlane(plane, scaleM, boardAspect);
    // Pitch is the single camera axis — 90° commits the derived 3D blend
    // target in the same write; the blend + elevation springs crossfade the
    // projection while the fly below interpolates pan/zoom/azimuth.
    store.setPitchDeg(90);
    // The facade is a committed elevation state — agree the DOM-facing flag
    // so the editing lock releases (wheel zoom frames the plane, not pan).
    store.setElevationActive(true);
    // The plane follows the title boundary's real bearing — treat it as a
    // facade normal even when it is not exactly cardinal.
    store.setElevationFacadeAzimuth(plane.azimuthDeg);
    if (reducedMotion) {
      store.setLiveRig(target);
      flyRef.current = null;
      return;
    }
    flyRef.current = {
      start: { ...store.liveRig },
      end: target,
      t0: performance.now(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly keyed on pin identity, not derived plane object
  }, [session?.elevationId, reducedMotion, scaleM, boardAspect]);

  useFrame(() => {
    const fly = flyRef.current;
    if (!fly) return;
    const t = (performance.now() - fly.t0) / 1000 / FLY_SECONDS;
    if (t >= 1) {
      useStudioStore.getState().setLiveRig(fly.end);
      flyRef.current = null;
      return;
    }
    const eased = t * t * (3 - 2 * t); // smoothstep
    useStudioStore.getState().setLiveRig(lerpRig(fly.start, fly.end, eased));
  });

  /**
   * The true plane hit from the native event. The fused camera is a
   * PerspectiveCamera instance carrying an ORTHO facade projection at the
   * pin — a ray built perspective-style (origin at the camera, through
   * unproject(z=0.5)) lands its reference point ~5000m away on the ortho
   * box and squashes plane hits ~120x (measured: a 0.28 NDC sweep became
   * ~9cm on the plane, and R3F's own `e.point` suffers the same). The
   * ortho lateral mapping is z-independent, so unproject the pointer
   * straight to a world point instead of building a ray.
   */
  const hitFromEvent = useCallback(
    (e: ThreeEvent<PointerEvent>): PlanePoint | null => {
      if (!plane) return null;
      const target = e.nativeEvent.currentTarget as HTMLElement | null;
      const rect = target?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const x = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1;
      const world = new THREE.Vector3(x, y, 0).unproject(camera);
      const local = worldToPlane(plane, world);
      const withinBounds =
        local.u >= -plane.widthM / 2 &&
        local.u <= plane.widthM / 2 &&
        local.v >= 0 &&
        local.v <= plane.heightM;
      return withinBounds ? local : null;
    },
    [plane, camera],
  );

  // ---- Pointer capture on the plane ----
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!session || !plane) return;
      e.stopPropagation();
      const local = hitFromEvent(e);
      if (!local) return;
      if (session.mode === "calibrate") {
        drawingRef.current = false;
        pointsRef.current = [local];
        draftVersionRef.current++;
        setPhotoCalibrateDraft({ a: local, b: local });
        return;
      }
      drawingRef.current = true;
      pointsRef.current = [local];
      draftVersionRef.current++;
    },
    [session, plane, hitFromEvent, setPhotoCalibrateDraft],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!session || !plane) return;
      e.stopPropagation();
      const local = hitFromEvent(e);
      if (!local) return;
      if (session.mode === "calibrate") {
        if (pointsRef.current.length === 0) return;
        draftVersionRef.current++;
        setPhotoCalibrateDraft({ a: pointsRef.current[0]!, b: local });
        return;
      }
      if (!drawingRef.current) return;
      const last = pointsRef.current[pointsRef.current.length - 1]!;
      if (
        Math.hypot(local.u - last.u, local.v - last.v) < MIN_POINT_SPACING_M
      ) {
        return;
      }
      if (pointsRef.current.length < MAX_DRAFT_POINTS) {
        pointsRef.current.push(local);
        draftVersionRef.current++;
      }
      // Live ε-snap indicator — the stitcher's weld-node highlight for the
      // trace cursor (plane point lifted into world metres).
      const w = planeToWorld(plane, local);
      setHover({ x: w.x, y: w.z });
    },
    [session, plane, hitFromEvent, setPhotoCalibrateDraft, setHover],
  );

  const onPointerUp = useCallback(() => {
    if (!session || !plane || !elevation) return;
    if (session.mode === "calibrate") {
      // The reference-line draft stays until the HUD applies it (the
      // operator picks the known length, then Apply rescales the plane).
      drawingRef.current = false;
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHover(null);
    const pts = pointsRef.current;
    if (pts.length < 2) {
      // A click, not a drag — selection pick (the same selection state the
      // placements and CAD features use). Shift-click toggles additively.
      const click = pts[0] ?? null;
      pointsRef.current = [];
      draftVersionRef.current++;
      if (click) {
        const id = nearestPlaneStrokeId(elevation.strokes, {
          x_m: click.u,
          y_m: click.v,
        });
        if (id) {
          toggleSelectRef({ kind: "photoStroke", id, elevationId: elevation.id });
        }
      }
      return;
    }
    const stroke: PhotoTraceStroke = {
      id: crypto.randomUUID(),
      points: pts.map((p) => ({ x_m: p.u, y_m: p.v })),
      color: PALETTE.sketchInk,
      width_px: 2.5,
    };
    addPhotoTraceStroke(session.elevationId, stroke);
    pointsRef.current = [];
    draftVersionRef.current++;
  }, [session, plane, elevation, addPhotoTraceStroke, toggleSelectRef, setHover]);

  /** Apply the reference-line calibration (HUD button). */
  const applyCalibration = useCallback(() => {
    if (!session || !elevation || !plane) return;
    const draft = session.calibrateDraft;
    if (!draft || session.calibrateReferenceM == null) return;
    const referenceM = session.calibrateReferenceM;
    const label = session.calibrateLabel.trim() || `${referenceM} m reference`;
    const result = applyReferenceCalibration({
      plane,
      drawnA: draft.a,
      drawnB: draft.b,
      referenceM,
      label,
    });
    updatePhotoElevation(elevation.id, {
      calibration: {
        plane_width_m: result.plane.widthM,
        reference_m: referenceM,
        label,
      },
      strokes: rescaleStrokes(elevation.strokes, result.strokeScale),
    });
    setPhotoCalibrateDraft(null);
    setPhotoTraceSession({ elevationId: elevation.id, mode: "trace" });
  }, [session, elevation, plane, updatePhotoElevation, setPhotoCalibrateDraft, setPhotoTraceSession]);

  // Expose applyCalibration to the DOM HUD via the store-scoped callback ref.
  useEffect(() => {
    applyCalibrationRef.current = applyCalibration;
  }, [applyCalibration]);

  if (!session || !plane || !elevation) return null;

  return (
    <group>
      <PhotoPlaneMesh
        elevationId={elevation.id}
        uri={elevation.uri}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {/* Committed trace strokes — true metres, drawn on the plane surface.
          Selected strokes overlay the Signal Blue emphasis line (same
          selection state as placements and CAD features). */}
      {elevation.strokes.map((s) => (
        <PlaneStroke
          key={s.id}
          stroke={s}
          plane={plane}
          selected={selectedStrokeIds.has(s.id)}
        />
      ))}
      {/* Live trace draft — imperative Line2 buffer, zero React churn. */}
      {session.mode === "trace" && (
        <TraceDraftLine
          pointsRef={pointsRef}
          versionRef={draftVersionRef}
          plane={plane}
          color={PALETTE.sketchInk}
        />
      )}
      {/* Reference-line draft (calibrate mode) — store-driven, proven path. */}
      {session.mode === "calibrate" && session.calibrateDraft && (
        <PlaneDraftLine
          points={[session.calibrateDraft.a, session.calibrateDraft.b]}
          plane={plane}
          color={PALETTE.gsPrimary}
        />
      )}
    </group>
  );
}

/** Imperative live-draft line — reads the drag refs, zero React re-renders. */
function TraceDraftLine({
  pointsRef,
  versionRef,
  plane,
  color,
}: {
  pointsRef: React.RefObject<PlanePoint[]>;
  versionRef: React.RefObject<number>;
  plane: PhotoPlane;
  color: string;
}) {
  const lineRef = useRef<ElementRef<typeof Line>>(null);
  const scratch = useMemo(() => new Float32Array(MAX_DRAFT_POINTS * 3), []);
  const lastVersion = useRef(-1);
  const basePoints = useMemo<Array<[number, number, number]>>(
    () => [[0, 0, 0], [0, 0, 0]],
    [],
  );

  useFrame(() => {
    if (!lineRef.current || versionRef.current === lastVersion.current) return;
    lastVersion.current = versionRef.current;
    const pts = pointsRef.current;
    const count = Math.min(pts.length, MAX_DRAFT_POINTS);
    if (count < 2) return;
    for (let i = 0; i < count; i++) {
      const w = planeToWorld(plane, pts[i]!);
      scratch[i * 3] = w.x;
      scratch[i * 3 + 1] = w.y;
      scratch[i * 3 + 2] = w.z;
    }
    lineRef.current.geometry.setPositions(scratch.subarray(0, count * 3));
    lineRef.current.computeLineDistances();
  });

  return <Line ref={lineRef} points={basePoints} color={color} lineWidth={2} transparent opacity={0.9} />;
}

function PlaneStroke({
  stroke,
  plane,
  selected,
}: {
  stroke: PhotoTraceStroke;
  plane: PhotoPlane;
  selected: boolean;
}) {
  const points = useMemo(() => {
    const axes = planeAxes(plane.azimuthDeg);
    const lift = 0.01; // slight lift off the plane face to avoid z-fighting
    return stroke.points.map((p) => {
      const w = planeToWorld(plane, { u: p.x_m, v: p.y_m });
      return new THREE.Vector3(
        w.x + axes.normal.x * lift,
        w.y,
        w.z + axes.normal.z * lift,
      );
    });
  }, [stroke.points, plane]);
  if (points.length < 2) return null;
  return (
    <group>
      <Line
        points={points}
        color={stroke.color}
        lineWidth={stroke.width_px}
        transparent
        opacity={0.95}
      />
      {selected && (
        <Line
          points={points}
          color={PALETTE.gsPrimary}
          lineWidth={5}
          transparent
          opacity={1}
        />
      )}
    </group>
  );
}

function PlaneDraftLine({
  points,
  plane,
  color,
}: {
  points: PlanePoint[];
  plane: PhotoPlane;
  color: string;
}) {
  const world = useMemo(
    () => points.map((p) => planeToWorld(plane, p)),
    [points, plane],
  );
  const vecs = useMemo(
    () => world.map((w) => new THREE.Vector3(w.x, w.y, w.z)),
    [world],
  );
  if (vecs.length < 2) return null;
  return <Line points={vecs} color={color} lineWidth={2} transparent opacity={0.9} />;
}

function PhotoPlaneMesh({
  elevationId,
  uri,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  elevationId: string;
  uri: string;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: () => void;
}) {
  const elevation = useStudioStore((s) =>
    s.photoElevations.find((e) => e.id === elevationId),
  );
  const plane = useMemo(
    () => (elevation ? photoPlaneFromElevation(elevation) : null),
    [elevation],
  );
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  // Read outside the loader callback so the effect does not depend on the
  // whole elevation object (which churns identity on every drag).
  const elevationName = elevation?.name ?? "";

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    // The photo is served cross-origin by the API (protected /photos route);
    // anonymous CORS keeps the canvas untainted for WebGL texture upload.
    loader.setCrossOrigin("anonymous");
    loader.load(
      uri,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        if (cancelled) return;
        setFailed(true);
        // Phase O — a corrupt/unreachable underlay used to fall back to a
        // bare grey fill and say nothing, so the operator traced against a
        // blank plane without knowing the photo never loaded. Name it.
        useStudioStore.getState().setUnderlayError({
          source: elevationName || "site photo",
          message:
            "The photo underlay could not be decoded. The plane is showing a blank fill, not the image — re-upload the photo or pick another elevation.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri, elevationName]);

  useEffect(
    () => () => {
      // Dispose on unmount/unpin — the gallery can hold many photos.
      if (texture) texture.dispose();
    },
    [texture],
  );

  if (!plane) return null;
  const yaw = (-plane.azimuthDeg * Math.PI) / 180;
  return (
    <mesh
      position={[plane.centreXM, plane.groundOffsetM + plane.heightM / 2, plane.centreZM]}
      rotation={[0, yaw, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <planeGeometry args={[plane.widthM, plane.heightM]} />
      <meshStandardMaterial
        side={THREE.DoubleSide}
        map={texture ?? undefined}
        color={failed ? "#F4F4F4" : "#ffffff"}
        transparent
        opacity={0.88}
        roughness={0.9}
        metalness={0}
        depthWrite={false}
      />
    </mesh>
  );
}

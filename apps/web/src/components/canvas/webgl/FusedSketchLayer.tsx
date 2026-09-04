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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import * as THREE from "three";
import type { CanvasStroke, SketchCanvas } from "@workstream/contracts";
import {
  collectSnapNodes,
  DEFAULT_STITCH_EPSILON_M,
  sunPositionAt,
  type SpatialPoint,
  type SpatialStroke,
} from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { sunDateFromPreset } from "../handoff/features/sunGrowth/sunDatePreset";
import { useStudioStore } from "./studioStore";
import {
  SketchCanvasGroup,
  worldToCanvasPct,
} from "./SketchCanvasGroup";
import { cfZPair } from "../cfz";
import { layerScaleAlpha, viewScaleRatioForZoom } from "./layerPolicy";
import { pctToWorld, worldToPct, type PctPoint, type HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { pointInPolygonXZ } from "./cutFill";
import { snapDrawPointer, type SnapHint } from "./snapWorld";
import { stationAtPct } from "./stationing";
import {
  armedNibSpec,
  bleedScaleForSegment,
  committedStrokeWidthPx,
  NEUTRAL_TELEMETRY,
  nibSpec,
  nibSpecForStroke,
  telemetryFromPointer,
  widthScaleForPoint,
  type NibSpec,
  type StylusTelemetry,
} from "./nibs";
import { weightMmForSignature } from "./officeTemplate";
import {
  dashSignatureMetres,
  materialById,
  type MaterialEntry,
} from "./materials";
import { dashPolyline, dashRunsToSegments, type Vec3 } from "./dashPolyline";
import { vectorizeStroke } from "./vectorize";
import {
  buildInkGeometry,
  buildStippleGeometry,
  stipplePointsForStroke,
  strokeSegmentData,
} from "./inkGeometry";
import { NibInkMaterial, StippleMaterial } from "./inkMaterial";
import { canvasWorldNormal, patchMaterialForAngleOpacity, seasonOpacityForCanvas } from "./AngleOpacityShader";
import { winterFactor, FALLOFF_PRESET_EDGES } from "./studioStore";

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
  /** Project latitude/longitude — resolves the solar azimuth that drives
   *  sun-aware hatching (the inverse sun angle). Null on flat/missing. */
  lat?: number;
  lng?: number;
}

export function FusedSketchLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
  lat,
  lng,
}: FusedSketchLayerProps) {
  // sketchMode gates whether this layer captures pointer events. When off,
  // the camera controls get the events (orbit/pan).
  const sketchMode = useStudioStore((s) => s.sketchMode);
  // A pinned photo-trace session owns pointer capture — the photo plane is
  // the raycast target, so the ground ink layer stands down completely.
  const photoTraceSession = useStudioStore((s) => s.photoTraceSession);
  // The committed strokes from the store — shared across plan and 3D views.
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const addSketchStroke = useStudioStore((s) => s.addSketchStroke);
  const updateSketchStroke = useStudioStore((s) => s.updateSketchStroke);
  // Spatial Sketching — the active canvas plane (null = ground plane).
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const sketchCanvases = useStudioStore((s) => s.sketchCanvases);
  // The armed nib — committed strokes carry its telemetry mapping.
  const activeNib = useStudioStore((s) => s.activeNib);
  const activeMaterialId = useStudioStore((s) => s.activeMaterialId);
  // Phase I — the brush width slider's value, stamped onto new strokes.
  const brushWidthOverride = useStudioStore((s) => s.brushWidthOverride);
  // Phase R — the standard this project is bound to. Both selections return a
  // stable reference (each is only ever replaced whole), so neither hands
  // zustand a fresh object per call.
  const officeTemplate = useStudioStore((s) => s.officeTemplate);
  const templateBinding = useStudioStore((s) => s.templateBinding);
  /**
   * The spec the LIVE line draws with: the armed nib, recoloured and
   * reweighted by the armed material and the bound standard, then overridden
   * by an explicit brush width. The live line drew with the raw nib, so ink
   * popped to the material's colour the instant it committed.
   *
   * The two commit paths deliberately keep stamping the RAW nib default
   * (`nibSpec(activeNib)`) rather than this: a stamped material weight would
   * read as an explicit operator choice later and pin the old weight onto the
   * stroke forever — see `committedStrokeWidthPx`.
   */
  const armedNib = useMemo(
    () =>
      armedNibSpec({
        nib: activeNib,
        materialId: activeMaterialId,
        templateWeightMm: activeMaterialId
          ? weightMmForSignature(officeTemplate, templateBinding, activeMaterialId)
          : undefined,
        brushWidthPx: brushWidthOverride,
      }),
    [
      activeNib,
      activeMaterialId,
      brushWidthOverride,
      officeTemplate,
      templateBinding,
    ],
  );
  const liveCoord = useStudioStore((s) => s.liveCoord);
  const setLiveTelemetry = useStudioStore((s) => s.setLiveTelemetry);
  const setSunAzimuthDeg = useStudioStore((s) => s.setSunAzimuthDeg);
  const sunMin = useStudioStore((s) => s.sunMin);
  const sunDatePreset = useStudioStore((s) => s.sunDatePreset);

  // Resolve the CURRENT solar azimuth from the SAME (sunDatePreset, sunMin)
  // axis the light rig samples — hatching and shadow studies agree. Pushed
  // to the store so the palette + hatch action can read it without props.
  useEffect(() => {
    if (lat == null || lng == null) {
      setSunAzimuthDeg(null);
      return;
    }
    const when = sunDateFromPreset(sunDatePreset, sunMin);
    setSunAzimuthDeg(sunPositionAt(lat, lng, when).azimuth_deg);
  }, [lat, lng, sunMin, sunDatePreset, setSunAzimuthDeg]);

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
  // Pen-down quiet state timeout — restores chrome 240ms after pen-up (§5.5).
  const penUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-point stylus telemetry — parallel to pointsRef (same index).
  const telemetryRef = useRef<StylusTelemetry[]>([]);
  // The canvas plane the current stroke is being drawn on (null = ground).
  // Set on pointer down, read on pointer up to stamp canvas_id on the stroke.
  const activeStrokeCanvasIdRef = useRef<string | null>(null);

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

  // Stitch ε-snap targets — WELDED endpoint nodes in world metres (the same
  // tolerance the stitcher fuses with). Pushed to the store so StitchSnapLayer
  // can pulse the dots when the cursor enters the snap radius.
  const stitchNodes = useMemo(() => {
    const spatial: SpatialStroke[] = strokes.map((s) => ({
      id: s.id,
      points: (s.points ?? []).map((p) => {
        const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
        return { x, y: z };
      }),
    }));
    return collectSnapNodes(spatial, DEFAULT_STITCH_EPSILON_M);
  }, [strokes, scaleM, boardAspect]);
  useEffect(() => {
    useStudioStore.getState().setStitchSnapNodes(stitchNodes);
    return () => useStudioStore.getState().setStitchSnapNodes([]);
    // Re-apply the ground nodes whenever a photo-trace session opens/closes
    // (the plane owns the snap set while pinned).
  }, [stitchNodes, photoTraceSession]);

  // Live drawing cursor for the ε-snap dots (world metres).
  const setHover = useCallback((p: SpatialPoint | null) => {
    useStudioStore.getState().setStitchHoverPoint(p);
  }, []);

  const planeSize = scaleM * 5;

  // ---- Stroke capture (raycast unprojection) ----
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!sketchMode) return;
      e.stopPropagation();
      const pt = e.point;
      if (!pt) return;

      // Record which canvas this stroke is being drawn on (null = ground).
      activeStrokeCanvasIdRef.current = activeCanvasId;

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
      // Pen-down quiet state — ribbon → rail, chips → 20%, dock hidden (§5.5).
      if (penUpTimerRef.current) { clearTimeout(penUpTimerRef.current); penUpTimerRef.current = null; }
      useStudioStore.getState().setPenDown(true);
      setSnapHint(null);
      setHover(null);
      pointsRef.current = [new THREE.Vector3(pt.x, FLAT_Y, pt.z)];
      telemetryRef.current = [telemetryFromPointer(e.nativeEvent)];
      setLiveTelemetry(telemetryRef.current[0]!);
      setLivePoints(pointsRef.current);
    },
    [sketchMode, strokes, scaleM, boardAspect, setHover, setLiveTelemetry, activeCanvasId],
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
      // Live ε-snap indicator — the stitcher's weld-node highlight.
      setHover({ x: snap.x, y: snap.z });
      // E·N·Z chip source (2.6) — the effective draw point in world metres.
      // Chainage is derived from the SAME stationing the ruler uses (2.1):
      // world X runs along the bottom stationing edge, so
      // chainage = stationAtPct(x / scaleM * 100, scaleM) = x.
      useStudioStore.getState().setLiveCoord({
        x: snap.x,
        z: snap.z,
        chainage: stationAtPct((snap.x / scaleM) * 100, scaleM),
      });

      if (last && last.distanceTo(new THREE.Vector3(snap.x, FLAT_Y, snap.z)) < 0.15) return;
      pointsRef.current.push(new THREE.Vector3(snap.x, FLAT_Y, snap.z));
      const tel = telemetryFromPointer(e.nativeEvent);
      telemetryRef.current.push(tel);
      setLiveTelemetry(tel);
      setLivePoints([...pointsRef.current]);
    },
    [sketchMode, extrudeTarget, scaleM, snapVertices, setHover, setLiveTelemetry],
  );

  const onPointerUp = useCallback(() => {
    if (!sketchMode) return;
    useStudioStore.getState().setLiveCoord(null);

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
    // Pen-up: restore chrome after 240ms delay (§5.5 — animate opacity only).
    penUpTimerRef.current = setTimeout(() => {
      useStudioStore.getState().setPenDown(false);
      penUpTimerRef.current = null;
    }, 240);
    setSnapHint(null);
    setHover(null);

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

    // Stamp the nib + its telemetry mapping onto the stroke. Telemetry is
    // rounded for storage (3dp pressure, 0.1° angles) — the renderer reads
    // it back per-segment via widthScaleForPoint / bleedScaleForSegment.
    const nib = nibSpec(activeNib);
    const telemetry = telemetryRef.current.map((t) => ({
      pressure: Math.round(t.pressure * 1000) / 1000,
      tilt_x_deg: Math.round(t.tiltX * 10) / 10,
      tilt_y_deg: Math.round(t.tiltY * 10) / 10,
      azimuth_deg: Math.round(t.azimuth * 10) / 10,
      altitude_deg: Math.round(t.altitude * 10) / 10,
    }));

    // Phase M — the armed material overrides the nib's colour and stamps its
    // id on the stroke so the renderer can lay the dash signature down.
    // Picking a material used to change nothing at all: `activeMaterialId`
    // was written by the palette and read by no one.
    const material = activeMaterialId ? materialById(activeMaterialId) : undefined;

    const stroke: CanvasStroke = {
      id: crypto.randomUUID(),
      points: finalPct.map((p) => ({ x_pct: p.x, y_pct: p.y })),
      color: material?.color ?? nib.color,
      // Phase I — the brush width slider is a per-stroke choice, so it has to
      // be stamped here. `setBrushWidthOverride` wrote the value and no commit
      // path read it, so dragging the slider moved a number in the flyout and
      // never changed a line. Stamping the raw nib default when the operator
      // has not chosen is what lets the material and template weights govern
      // at render (see `committedStrokeWidthPx`).
      width_px: brushWidthOverride ?? nib.baseWidthPx,
      kind: "ink",
      nib: nib.kind,
      ...(material ? { material: material.id } : {}),
      telemetry,
      // Spatial Sketching — stamp the parent canvas plane id (null = ground).
      canvas_id: activeStrokeCanvasIdRef.current,
    };

    addSketchStroke(stroke);
    // Trace & Bake: vectorize in the background — the parametric anchor
    // (cubic-Bézier node network) lands on the committed stroke on idle.
    scheduleVectorize(stroke.id, finalPct, closed);
    setLivePoints([]);
  }, [
    sketchMode,
    extrudeTarget,
    extrudeHeight,
    updateSketchStroke,
    addSketchStroke,
    scaleM,
    boardAspect,
    setHover,
    activeNib,
    activeMaterialId,
    brushWidthOverride,
  ]);

  // ---- Canvas-plane pointer handlers (Spatial Sketching) ----
  // When a canvas plane is active, the SketchCanvasGroup's raycast mesh
  // captures pointer events. The world point is localized to the canvas's
  // board-% space, then converted back to world space for the live renderer.
  const activeCanvas = useMemo(
    () => sketchCanvases.find((c) => c.id === activeCanvasId) ?? null,
    [sketchCanvases, activeCanvasId],
  );

  const onCanvasPointerDown = useCallback(
    (canvasId: string, worldPoint: THREE.Vector3) => {
      if (!sketchMode) return;
      activeStrokeCanvasIdRef.current = canvasId;
      isDrawingRef.current = true;
      // Pen-down quiet state — ribbon → rail, chips → 20%, dock hidden (§5.5).
      if (penUpTimerRef.current) { clearTimeout(penUpTimerRef.current); penUpTimerRef.current = null; }
      useStudioStore.getState().setPenDown(true);
      setSnapHint(null);
      setHover(null);
      // For canvas-plane strokes, the live point is the world point itself
      // (the canvas transform is applied by the parent group on render).
      pointsRef.current = [worldPoint];
      telemetryRef.current = [NEUTRAL_TELEMETRY];
      setLiveTelemetry(telemetryRef.current[0]!);
      setLivePoints(pointsRef.current);
    },
    [sketchMode, setHover, setLiveTelemetry],
  );

  const onCanvasPointerMove = useCallback(
    (canvasId: string, worldPoint: THREE.Vector3) => {
      if (!sketchMode || !isDrawingRef.current) return;
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last && last.distanceTo(worldPoint) < 0.15) return;
      pointsRef.current.push(worldPoint);
      setLivePoints([...pointsRef.current]);
    },
    [sketchMode],
  );

  const onCanvasPointerUp = useCallback(
    (canvasId: string) => {
      if (!sketchMode || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      // Pen-up: restore chrome after 240ms delay (§5.5).
      penUpTimerRef.current = setTimeout(() => {
        useStudioStore.getState().setPenDown(false);
        penUpTimerRef.current = null;
      }, 240);
      setSnapHint(null);
      setHover(null);

      const worldPts = pointsRef.current;
      if (worldPts.length < 2) {
        setLivePoints([]);
        return;
      }

      // Localize world points to the canvas's board-% space.
      const canvas = sketchCanvases.find((c) => c.id === canvasId);
      if (!canvas) {
        setLivePoints([]);
        return;
      }
      const pctPoints: PctPoint[] = worldPts.map((p) =>
        worldToCanvasPct(p, canvas, scaleM, boardAspect),
      );
      const closed =
        worldPts.length >= MIN_POLY_POINTS &&
        worldPts[0]!.distanceTo(worldPts[worldPts.length - 1]!) < SNAP_CLOSE_M;
      const finalPct = closed ? [...pctPoints, pctPoints[0]!] : pctPoints;

      const nib = nibSpec(activeNib);
      // Phase M — same material stamp as the ground-plane commit above; a
      // stroke drawn on a canvas plane is no less a setback line.
      const material = activeMaterialId ? materialById(activeMaterialId) : undefined;
      const stroke: CanvasStroke = {
        id: crypto.randomUUID(),
        points: finalPct.map((p) => ({ x_pct: p.x, y_pct: p.y })),
        color: material?.color ?? nib.color,
        // Same width stamp as the ground-plane commit above.
        width_px: brushWidthOverride ?? nib.baseWidthPx,
        kind: "ink",
        nib: nib.kind,
        ...(material ? { material: material.id } : {}),
        canvas_id: canvasId,
      };
      addSketchStroke(stroke);
      scheduleVectorize(stroke.id, finalPct, closed);
      setLivePoints([]);
    },
    [
      sketchMode,
      sketchCanvases,
      scaleM,
      boardAspect,
      activeNib,
      activeMaterialId,
      brushWidthOverride,
      addSketchStroke,
      setHover,
    ],
  );

  // ---- Render ----
  if (!sketchMode || photoTraceSession) return null;
  return (
    <group>
      {/* Spatial Sketching — when a canvas plane is active, its raycast mesh
          captures pointer events. Otherwise the ground mesh handles sketching. */}
      {activeCanvas ? (
        <SketchCanvasGroup
          scaleM={scaleM}
          onCanvasPointerDown={onCanvasPointerDown}
          onCanvasPointerMove={onCanvasPointerMove}
          onCanvasPointerUp={onCanvasPointerUp}
        />
      ) : (
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
      )}

      {/* Committed strokes — rendered from the shared store, draped over terrain */}
      {strokes.map((s) => (
        <CommittedStrokeRenderer
          key={s.id}
          stroke={s}
          scaleM={scaleM}
          boardAspect={boardAspect}
          sampler={sampler}
          sketchCanvases={sketchCanvases}
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

      {/* Live drawing stroke — the armed nib's shader profile, drapes in
          real time as you draw in 3D */}
      {livePoints.length >= 2 && (
        <LiveNibLine
          points={livePoints}
          telemetry={telemetryRef.current}
          nib={armedNib}
          sampler={sampler}
        />
      )}

      {/* Draw-time snap marker (kind-coloured ring + glyph chip) */}
      {snapHint && <SnapMarker hint={snapHint} />}

      {/* Nib crosshair (2.6) — scene-space crossing lines riding the nib.
          Renders wherever the live draw point is, at the snap-resolved
          coordinate, so it reads the exact point that will be committed. */}
      {liveCoord && <NibCrosshair x={liveCoord.x} z={liveCoord.z} />}
    </group>
  );
}

/**
 * Trace & Bake, step 2: background vectorization. After the gesture ends the
 * pointer path is simplified (Douglas-Peucker) and smoothed into cubic Bézier
 * segments (centripetal Catmull-Rom) on the IDLE scheduler, then attached to
 * the committed stroke as its parametric anchor (`stroke.vector`). The anchor
 * lives in board-% space, so the visual ink scales / rotates / projects with
 * the stroke into Elevation and Garden 3D without any world-space drift.
 */
function scheduleVectorize(id: string, points: PctPoint[], closed: boolean) {
  const run = () => {
    const v = vectorizeStroke(points, { closed });
    // Adapt the board-% anchor to the contract shape ({x_pct, y_pct}).
    useStudioStore.getState().updateSketchStroke(id, {
      vector: {
        closed: v.closed,
        segments: v.segments.map((seg) => ({
          c0: { x_pct: seg.c0.x, y_pct: seg.c0.y },
          c1: { x_pct: seg.c1.x, y_pct: seg.c1.y },
          c2: { x_pct: seg.c2.x, y_pct: seg.c2.y },
          c3: { x_pct: seg.c3.x, y_pct: seg.c3.y },
        })),
      },
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 500 });
  } else {
    setTimeout(run, 0);
  }
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

/**
 * R.4 — resolve a committed stroke's nib against the BOUND office template,
 * so a weight fixed in the standard reaches drawings that already exist
 * (rule 1: the binding is a reference, not a copy).
 *
 * Both store reads select a stable object reference — the template and the
 * binding are only ever replaced whole — so this never feeds zustand a fresh
 * object per call, which is the loop that took `HistoryScrub` into the error
 * boundary.
 */
function useNibForStroke(stroke: CanvasStroke): NibSpec {
  const template = useStudioStore((s) => s.officeTemplate);
  const binding = useStudioStore((s) => s.templateBinding);
  return useMemo(
    () =>
      nibSpecForStroke(
        stroke,
        stroke.material
          ? weightMmForSignature(template, binding, stroke.material)
          : undefined,
      ),
    [stroke, template, binding],
  );
}

/** Render a committed stroke — nib-dispatched (line ink vs stipple dots).
 *  Strokes with a canvas_id render inside their parent canvas group (the
 *  group applies the canvas's position + rotation, so the stroke's board-%
 *  coordinates map to the canvas's local world space). Ground strokes
 *  (canvas_id absent) render flat on the ground as before. */
function CommittedStrokeRenderer({
  stroke,
  scaleM,
  boardAspect,
  sampler,
  sketchCanvases,
}: {
  stroke: CanvasStroke;
  scaleM: number;
  boardAspect: number;
  sampler: ((x: number, z: number) => number) | null;
  sketchCanvases: SketchCanvas[];
}) {
  const nib = useNibForStroke(stroke);
  // Spatial Sketching — if the stroke belongs to a canvas plane, wrap it in
  // the canvas's group so it inherits the plane's position + rotation.
  const canvas = useMemo(
    () =>
      stroke.canvas_id
        ? sketchCanvases.find((c) => c.id === stroke.canvas_id) ?? null
        : null,
    [stroke.canvas_id, sketchCanvases],
  );

  // Phase 3: Angle-Based Opacity — compute the canvas's world-space normal
  // from its rotation quaternion. A plane facing up has local normal (0,1,0);
  // applying the quaternion rotates it into world space. This normal is passed
  // to the stroke material's uCanvasNormal uniform so the fragment shader can
  // fade the stroke when viewed edge-on.
  const canvasNormal = useMemo(
    () => (canvas ? canvasWorldNormal(canvas.rotation) : null),
    [canvas],
  );

  // Phase 4: Seasonal Canvas Filtering — read seasonProgress from the store
  // and compute the winterFactor (0 = peak summer, 1 = deep winter). Then
  // derive the canvas's seasonal opacity from its season_tag:
  //   SUMMER → 1 - winterFactor (fades out in winter)
  //   WINTER → winterFactor     (fades in in winter)
  //   ALL    → 1.0              (always visible)
  // The seasonOpacity is passed to the stroke material's uSeasonOpacity uniform
  // and updated per-frame so the crossfade tracks the timeline slider live.
  const seasonProgress = useStudioStore((s) => s.seasonProgress);
  const falloffPreset = useStudioStore((s) => s.falloffPreset);
  const seasonOpacity = useMemo(
    () =>
      canvas
        ? seasonOpacityForCanvas(canvas.season_tag, winterFactor(seasonProgress))
        : 1.0,
    [canvas, seasonProgress],
  );
  // Phase E (turn 14c): the falloff preset's smoothstep upper edge. Passed to
  // patchMaterialForAngleOpacity and live-updated per-frame so the operator
  // can switch presets without re-mounting strokes.
  const falloffEdge1 = FALLOFF_PRESET_EDGES[falloffPreset][1];

  // Phase 6: Sketch-to-CAD Extrusion — read the extrusion tool state.
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const selectExtrusionStroke = useStudioStore((s) => s.selectExtrusionStroke);

  // The extrusion mass to render:
  // - Committed: stroke.extrude_height_m > 0 → render the persistent mass.
  // - Live preview: extrusion tool armed + this stroke selected → render
  //   with activeExtrusionDepth so the slider adjusts the depth in real-time.
  const committedHeight = stroke.extrude_height_m ?? 0;
  const isSelectedForExtrusion =
    extrusionToolArmed && selectedExtrusionStrokeId === stroke.id;
  const extrudeHeightM = isSelectedForExtrusion
    ? activeExtrusionDepth
    : committedHeight;

  // Phase M.3 — a stroke drawn with a SEMANTIC markup material renders as a
  // CAD line carrying its dash signature, not as organic ink. The signature
  // is what keeps a setback, a gas run and a survey line apart in greyscale;
  // colour alone cannot, and organic ink cannot carry a dash at all.
  const markupMaterial = useMemo(() => {
    const m = stroke.material ? materialById(stroke.material) : undefined;
    return m?.semantic && m.dash && m.dash.length > 0 ? m : null;
  }, [stroke.material]);

  const inner = markupMaterial ? (
    <MarkupStrokeRenderer
      stroke={stroke}
      material={markupMaterial}
      scaleM={scaleM}
      boardAspect={boardAspect}
      sampler={canvas ? null : sampler}
    />
  ) : nib.kind === "stipple" ? (
    <StippleStrokeRenderer
      stroke={stroke}
      scaleM={scaleM}
      boardAspect={boardAspect}
      sampler={canvas ? null : sampler}
      canvasNormal={canvasNormal}
      seasonOpacity={seasonOpacity}
      falloffEdge1={falloffEdge1}
    />
  ) : (
    <InkStrokeRenderer
      stroke={stroke}
      nib={nib}
      scaleM={scaleM}
      boardAspect={boardAspect}
      sampler={canvas ? null : sampler}
      canvasNormal={canvasNormal}
      seasonOpacity={seasonOpacity}
      falloffEdge1={falloffEdge1}
    />
  );

  // Phase 6: the extrusion mass mesh. Rendered alongside the stroke ink so
  // both are visible — the ink is the provenance, the mass is the volume.
  const extrudeMass = extrudeHeightM > 0.05 ? (
    <ExtrudeMass
      stroke={stroke}
      heightM={extrudeHeightM}
      scaleM={scaleM}
      boardAspect={boardAspect}
    />
  ) : null;

  if (!canvas) {
    return (
      <>
        {inner}
        {extrudeMass}
      </>
    );
  }
  // Render inside the canvas's group — the stroke's board-% → local world
  // conversion (pctToWorld) produces ground-plane coordinates, and the group
  // transforms them into the canvas's world space. Terrain draping is
  // disabled (sampler=null) because canvas strokes sit on a plane, not ground.
  return (
    <group
      position={canvas.position}
      quaternion={canvas.rotation}
      // Phase 6: clicking a stroke while the extrusion tool is armed selects
      // it for extrusion. The group's pointer handler catches clicks on any
      // child (stroke ink or mass).
      onPointerDown={
        extrusionToolArmed && !selectedExtrusionStrokeId
          ? (e) => {
            e.stopPropagation();
            selectExtrusionStroke(stroke.id);
          }
          : undefined
      }
    >
      {inner}
      {extrudeMass}
    </group>
  );
}

interface InkRenderBase {
  scaleM: number;
  boardAspect: number;
  sampler: ((x: number, z: number) => number) | null;
  /** Phase 3: the parent canvas's world-space normal. When non-null, the
   *  stroke material is patched with angle-based opacity (fades edge-on). */
  canvasNormal: THREE.Vector3 | null;
  /** Phase 4: seasonal crossfade opacity (0-1). Multiplied into the final
   *  alpha alongside the angle-opacity factor. 1.0 = always visible. */
  seasonOpacity: number;
  /** Phase E (turn 14c): the smoothstep upper edge for angle-opacity falloff.
   *  Lower = gentler fade (WIDE), higher = steeper fade (NARROW). */
  falloffEdge1: number;
}

/**
 * A committed line-ink stroke (graphite / technical ink / chisel) rendered
 * through the dynamic NibInkMaterial — per-segment width from pressure/tilt
 * telemetry, procedural grain, edge softness and wet-ink bleed. Draped over
 * the terrain via per-frame position writes (the Vertical Truth lerp).
 */
/**
 * Phase M.3/M.4 — a semantic markup stroke, drawn with its dash signature.
 *
 * The signature is laid down in WORLD METRES by `dashPolyline`, so its
 * length on the ground is fixed by the sheet scale and the stroke weight and
 * does not move with the camera (M.4: "dash length is constant across 3 zoom
 * levels"). Rendered as explicit segments rather than a two-value
 * dashSize/gapSize, because the real signatures include dash-dot patterns
 * (`gas` is [18, 7, 3, 7]) that a two-value dash cannot express.
 */
function MarkupStrokeRenderer({
  stroke,
  material,
  scaleM,
  boardAspect,
  sampler,
}: {
  stroke: CanvasStroke;
  material: MaterialEntry;
  scaleM: number;
  boardAspect: number;
  sampler: ((x: number, z: number) => number) | null;
}) {
  const segments = useMemo(() => {
    const world: Vec3[] = (stroke.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return [x, sampler ? sampler(x, z) + MARKUP_LIFT_M : FLAT_Y, z];
    });
    if (world.length < 2) return [];
    return dashRunsToSegments(
      dashPolyline(world, dashSignatureMetres(material, 200, stroke.width_px)),
    );
  }, [stroke.points, stroke.width_px, material, scaleM, boardAspect, sampler]);

  if (segments.length < 2) return null;
  return (
    <Line
      segments
      points={segments}
      color={material.color}
      lineWidth={stroke.width_px ?? 2}
      transparent
      opacity={0.95}
      depthWrite={false}
    />
  );
}

/** Lift markup off the terrain so a draped dash does not z-fight the ground. */
const MARKUP_LIFT_M = 0.03;

function InkStrokeRenderer({
  stroke,
  nib,
  scaleM,
  boardAspect,
  sampler,
  canvasNormal,
  seasonOpacity,
  falloffEdge1,
}: { stroke: CanvasStroke; nib: NibSpec } & InkRenderBase) {
  // Base world points (XZ) — computed once. Y is updated per-frame below.
  const basePoints = useMemo(() => {
    // points ?? [] — defensive against legacy strokes (see strokeToWorldPoints).
    return (stroke.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return [x, FLAT_Y, z] as [number, number, number];
    });
  }, [stroke.points, scaleM, boardAspect]);

  // The dynamic ink geometry: instanceStart/End + per-segment aWidth/aBleed.
  const geometry = useMemo(
    () => buildInkGeometry(strokeSegmentData(stroke, nib, scaleM, boardAspect)),
    [stroke, nib, scaleM, boardAspect],
  );
  const material = useMemo(
    () => {
      const m = new NibInkMaterial({
        color: nib.color,
        // R.4 — the standard's weight governs unless the operator explicitly
        // chose a width for this stroke. `stroke.width_px ?? …` read every
        // stamped width as a choice, which pinned the commit-time nib default
        // onto the line and discarded both the material and template weights.
        linewidth: committedStrokeWidthPx(stroke, nib),
        opacity: nib.opacity,
        grain: nib.grain,
        edgeSoft: nib.edgeSoft,
        bleed: nib.bleed,
        // Alcohol marker multiplies (spec 3.3) — crossings build up.
        multiply: nib.kind === "chisel-marker",
      });
      // Phase 3+4: patch the material with angle-based opacity + seasonal
      // crossfade for canvas strokes. This injects the view-direction varying
      // + smoothstep alpha + uSeasonOpacity into the NibInkMaterial's shader
      // via onBeforeCompile, preserving nib rendering.
      if (canvasNormal) {
        patchMaterialForAngleOpacity(m as unknown as THREE.Material & {
          uniforms: Record<string, { value: unknown }>;
        }, canvasNormal, seasonOpacity, falloffEdge1);
      }
      return m;
    },
    [nib, stroke, canvasNormal, seasonOpacity, falloffEdge1],
  );
  const line2 = useMemo(() => new Line2(geometry, material), [geometry, material]);
  // The Line2 ref — we mutate its geometry positions in place each frame.
  const lineRef = useRef<Line2 | null>(null);
  // Pre-allocated Float32Array scratch for the per-frame position write.
  const positionsScratch = useMemo(
    () => new Float32Array(basePoints.length * 3),
    [basePoints.length],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // Per-frame: keep the material resolution in sync (drei <Line> parity),
  // apply the sketchInk scale-band visibility cross-fade (macro zoom
  // dissolves detail ink instead of popping it), and lerp each vertex Y from
  // flat (plan) to terrain-draped (3D) in lockstep with the viewBlend.
  // Phase 4: also update uSeasonOpacity per-frame so the seasonal crossfade
  // tracks the timeline slider live without recreating the material.
  useFrame(({ size }) => {
    material.resolution.set(size.width, size.height);
    const alpha = layerScaleAlpha(
      "sketchInk",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    material.opacity = nib.opacity * alpha;
    // Phase 4: live-update the seasonal opacity uniform.
    if (canvasNormal && material.uniforms.uSeasonOpacity) {
      material.uniforms.uSeasonOpacity.value = seasonOpacity;
    }
    // Phase E (turn 14c): live-update the falloff edge uniform so the
    // operator can switch presets without re-mounting strokes.
    if (canvasNormal && material.uniforms.uFalloffEdge1) {
      material.uniforms.uFalloffEdge1.value = falloffEdge1;
    }
    if (!lineRef.current || basePoints.length === 0) return;
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

  if (basePoints.length < 2) return null;
  return <primitive object={line2} ref={lineRef} />;
}

/**
 * A committed stipple/speckle stroke — pressure-subsampled round dots whose
 * size scales with stylus altitude (StippleMaterial). Drapes with the same
 * Vertical Truth lerp as the line ink.
 */
function StippleStrokeRenderer({
  stroke,
  scaleM,
  boardAspect,
  sampler,
  canvasNormal,
  seasonOpacity,
  falloffEdge1,
}: { stroke: CanvasStroke } & InkRenderBase) {
  const nib = useNibForStroke(stroke);
  const points = useMemo(
    () => stipplePointsForStroke(stroke, scaleM, boardAspect),
    [stroke, scaleM, boardAspect],
  );
  const geometry = useMemo(() => buildStippleGeometry(points), [points]);
  const material = useMemo(
    () => {
      const m = new StippleMaterial({ color: nib.color, opacity: nib.opacity });
      // Phase 3+4: patch with angle-based opacity + seasonal crossfade.
      if (canvasNormal) {
        patchMaterialForAngleOpacity(m, canvasNormal, seasonOpacity, falloffEdge1);
      }
      return m;
    },
    [nib.color, nib.opacity, canvasNormal, seasonOpacity, falloffEdge1],
  );
  const cloud = useMemo(() => new THREE.Points(geometry, material), [geometry, material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ size, viewport }) => {
    // PointsMaterial convention: scale = drawing-buffer height ÷ 2.
    material.uniforms.uScale.value = viewport.dpr * size.height * 0.5;
    // sketchInk scale-band visibility — dots dissolve at macro zoom.
    const alpha = layerScaleAlpha(
      "sketchInk",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    material.uniforms.uOpacity.value = nib.opacity * alpha;
    // Phase 4: live-update the seasonal opacity uniform.
    if (canvasNormal && material.uniforms.uSeasonOpacity) {
      material.uniforms.uSeasonOpacity.value = seasonOpacity;
    }
    // Phase E (turn 14c): live-update the falloff edge uniform.
    if (canvasNormal && material.uniforms.uFalloffEdge1) {
      material.uniforms.uFalloffEdge1.value = falloffEdge1;
    }
    if (!sampler || points.length === 0) return;
    const { viewBlend } = useStudioStore.getState();
    if (viewBlend < 0.001) return;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < points.length; i++) {
      const [x, , z] = points[i]!.world;
      arr[i * 3 + 1] = drapedY(x, z, viewBlend, sampler);
    }
    pos.needsUpdate = true;
  });

  if (points.length === 0) return null;
  return <primitive object={cloud} />;
}

/**
 * A live (in-progress) stroke rendered through the armed nib's shader
 * profile — the "live shader overlay" while the gesture is still in flight.
 * Geometry is rebuilt per pointer-move (same cost the drei <Line> path paid).
 */
function LiveNibLine({
  points,
  telemetry,
  nib,
  sampler,
}: {
  points: THREE.Vector3[];
  telemetry: StylusTelemetry[];
  nib: NibSpec;
  sampler: ((x: number, z: number) => number) | null;
}) {
  const basePoints = useMemo(
    () => points.map((p) => [p.x, FLAT_Y, p.z] as [number, number, number]),
    [points],
  );
  const geometry = useMemo(() => {
    const n = basePoints.length;
    const positions = new Float32Array(n * 3);
    const widths = new Float32Array(Math.max(0, n - 1));
    const bleeds = new Float32Array(Math.max(0, n - 1));
    for (let i = 0; i < n; i++) {
      positions[i * 3] = basePoints[i]![0];
      positions[i * 3 + 1] = FLAT_Y;
      positions[i * 3 + 2] = basePoints[i]![2];
    }
    for (let i = 0; i < widths.length; i++) {
      const ta = telemetry[i] ?? NEUTRAL_TELEMETRY;
      const tb = telemetry[i + 1] ?? NEUTRAL_TELEMETRY;
      widths[i] = (widthScaleForPoint(nib, ta) + widthScaleForPoint(nib, tb)) / 2;
      const dx = basePoints[i + 1]![0] - basePoints[i]![0];
      const dz = basePoints[i + 1]![2] - basePoints[i]![2];
      bleeds[i] = bleedScaleForSegment(nib, Math.hypot(dx, dz));
    }
    return buildInkGeometry({ positions, widths, bleeds });
  }, [basePoints, telemetry, nib]);
  const material = useMemo(
    () =>
      new NibInkMaterial({
        color: nib.color,
        linewidth: nib.baseWidthPx,
        opacity: nib.opacity * 0.7,
        grain: nib.grain,
        edgeSoft: nib.edgeSoft,
        bleed: nib.bleed,
        multiply: nib.kind === "chisel-marker",
      }),
    [nib],
  );
  const line2 = useMemo(() => new Line2(geometry, material), [geometry, material]);
  const lineRef = useRef<Line2 | null>(null);
  const positionsScratch = useMemo(
    () => new Float32Array(Math.max(basePoints.length, 2) * 3),
    [basePoints.length],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ size }) => {
    material.resolution.set(size.width, size.height);
    const alpha = layerScaleAlpha(
      "sketchInk",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    material.opacity = nib.opacity * 0.7 * alpha;
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

  if (basePoints.length < 2) return null;
  return <primitive object={line2} ref={lineRef} />;
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
 * lock, truth blue = the geometric constraints (title boundary + 45° ray),
 * charcoal ink = close. Boundary and angle share the truth blue because both
 * are constraints rather than points; the glyph is what distinguishes them.
 * The glyph chip is a constant-px drei <Html> span (the SVG snapGlyph badge
 * equivalent).
 *
 * Exported so the precision drafting layer renders the SAME marker as the
 * freehand layer — one snap vocabulary across both input paths.
 */
export function SnapMarker({ hint }: { hint: SnapHint }) {
  const color =
    hint.kind === "vertex"
      ? PALETTE.gsConflict
      : hint.kind === "close"
        ? PALETTE.gsInk
        : "#0030CF"; // boundary / angle — Signal Blue (truth)
  const glyph =
    hint.kind === "vertex"
      ? "●"
      : hint.kind === "close"
        ? "◎"
        : hint.kind === "boundary"
          ? "▬"
          : "∠";

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
        zIndexRange={cfZPair("spatialAnnotation")}
        style={{ pointerEvents: "none" }}
      >
        <span
          data-testid="snap-glyph"
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--ws-text-md)",
            fontWeight: 600,
            color,
            background: "color-mix(in srgb, var(--ws-panel) 80%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ws-line) 60%, transparent)",
            borderRadius: "var(--ws-radius-3)",
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

/** Crosshair arm half-length in world metres — visible, not intrusive. */
const CROSSHAIR_HALF_M = 0.5;

/**
 * The nib crosshair (spec 2.6) — two crossing lines in scene space riding the
 * live draw point. Position comes from the store's `liveCoord` (the
 * snap-resolved point that will be committed), so marker and committed ink
 * can never disagree.
 */
export function NibCrosshair({ x, z }: { x: number; z: number }) {
  const pts = useMemo(
    () => ({
      h: [
        new THREE.Vector3(x - CROSSHAIR_HALF_M, FLAT_Y + 0.06, z),
        new THREE.Vector3(x + CROSSHAIR_HALF_M, FLAT_Y + 0.06, z),
      ],
      v: [
        new THREE.Vector3(x, FLAT_Y + 0.06, z - CROSSHAIR_HALF_M),
        new THREE.Vector3(x, FLAT_Y + 0.06, z + CROSSHAIR_HALF_M),
      ],
    }),
    [x, z],
  );
  return (
    <group>
      <Line points={pts.h} color={PALETTE.gsInk} lineWidth={1} transparent opacity={0.85} depthWrite={false} />
      <Line points={pts.v} color={PALETTE.gsInk} lineWidth={1} transparent opacity={0.85} depthWrite={false} />
    </group>
  );
}

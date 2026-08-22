"use client";

/**
 * Gold Standard 2026 — Precision Drafting Layer (Polyline + Area).
 *
 * The click-to-place counterpart to freehand ink. Freehand plus a classifier
 * is a guess; setting out a 4.2 m path or a title-parallel garden edge needs
 * exact vertices, and until now the WebGL surface had no way to produce one
 * (docs/precision-drafting-tools-spec.md §4).
 *
 * Interaction (one draft session, both tools):
 *   - click            place a vertex, resolved through `snapDrawPointer`
 *                      (close → vertex → title boundary → 45°)
 *   - pointer move     rubber-band preview + live snap marker + readout
 *   - Backspace        drop the last vertex
 *   - Esc              cancel the whole run and disarm
 *   - Enter / dbl-clk  finish an open run (Area always closes)
 *   - click the origin the `close` snap finishes a closed run
 *
 * This is a TOOL-GATED pointer mode, exactly like the marquee tool, so it
 * inherits the pan law: with no drafting tool armed a plain drag still pans
 * and mod-drag still orbits. `StudioControls` yields the gesture while a
 * session is open (the same "capture layer wins" branch ink/tape/asset use).
 *
 * Rendering is deliberately thin: the committed run, a dashed rubber band and
 * vertex discs, riding the terrain sampler at the marker clearance. Committed
 * geometry is drawn by the EXISTING renderers — a polyline through
 * `CommittedStrokeRenderer` (it reads `points`), an area through
 * `FeatureLayer` — so this layer owns no persistence visuals.
 *
 * Binding: docs/precision-drafting-tools-spec.md §5
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { PALETTE } from "../../../styles/colorTokens";
import { cfZPair } from "../cfz";
import type { HeightmapPoint } from "./coordTransform";
import {
  boundaryEdgeSegments,
  draftAreaM2,
  draftRunLengthM,
  MIN_AREA_VERTICES,
  segmentReadout,
} from "./draftShape";
import { SnapMarker } from "./FusedSketchLayer";
import { SPATIAL_LAYER } from "./layerContract";
import { snapDrawPointer, type SnapHint, type WorldXZ } from "./snapWorld";
import { useStudioStore } from "./studioStore";
import { createElevationSampler } from "./terrainMath";
import { isTypingTarget } from "./studioShortcuts";

/** Draft geometry rides the survey-furniture clearance — it is transient. */
const DRAFT_Y = SPATIAL_LAYER.markers.offsetM;
/** Readout chip hover height above the draft line (world metres). */
const READOUT_LIFT_M = 0.4;

const readoutStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-sm)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--gs-primary)",
  background: "color-mix(in srgb, var(--gs-glass) 82%, transparent)",
  border: "1px solid color-mix(in srgb, var(--gs-primary) 40%, transparent)",
  borderRadius: "var(--gs-radius-md)",
  padding: "1px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

export interface DraftShapeLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — the draft rides the same terrain as the ink and the tape. */
  heightmapPoints?: HeightmapPoint[];
}

export function DraftShapeLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: DraftShapeLayerProps) {
  const draftSession = useStudioStore((s) => s.draftSession);
  const siteBoundary = useStudioStore((s) => s.siteBoundary);
  const addDraftVertex = useStudioStore((s) => s.addDraftVertex);
  const undoDraftVertex = useStudioStore((s) => s.undoDraftVertex);
  const cancelDraft = useStudioStore((s) => s.cancelDraft);
  const commitDraft = useStudioStore((s) => s.commitDraft);

  /** The live snap decision for the pointer — drives the band and the marker. */
  const [hint, setHint] = useState<SnapHint | null>(null);

  const armed = draftSession != null;

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  /**
   * Title boundary edges as world-metre snap segments. This is what keeps a
   * drafted edge reconciled WITH the boundary rather than merely near it
   * (AGENTS.md title-boundary reconciliation rule; spec §8 decision 2).
   */
  const boundaryEdges = useMemo(
    () => boundaryEdgeSegments(siteBoundary, scaleM, boardAspect),
    [siteBoundary, scaleM, boardAspect],
  );

  /**
   * Resolve a raw pointer through the snap ladder. Reads the run transiently
   * so the callback identity survives every vertex placement.
   */
  const resolve = useCallback(
    (rawX: number, rawZ: number): SnapHint => {
      const run = useStudioStore.getState().draftSession?.vertices ?? [];
      // The origin magnet only arms once closing would make a polygon —
      // otherwise the second click of every run would land back on the first.
      const origin = run.length >= MIN_AREA_VERTICES ? run[0]! : null;
      return snapDrawPointer(rawX, rawZ, {
        origin,
        last: run[run.length - 1] ?? null,
        vertices: run,
        boundaryEdges,
      });
    },
    [boundaryEdges],
  );

  const finish = useCallback(
    (closed: boolean) => {
      const tool = useStudioStore.getState().draftSession?.tool;
      if (!tool) return;
      // Area is a region: it can only ever commit closed (spec §5).
      commitDraft(scaleM, boardAspect, tool === "area" ? true : closed);
      setHint(null);
    },
    [commitDraft, scaleM, boardAspect],
  );

  // Keyboard: Backspace steps back, Esc cancels, Enter finishes.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDraft();
        setHint(null);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        undoDraftVertex();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, cancelDraft, undoDraftVertex, finish]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!e.point) return;
      e.stopPropagation();
      const snap = resolve(e.point.x, e.point.z);
      setHint(snap);
      const run = useStudioStore.getState().draftSession?.vertices ?? [];
      if (snap.kind === "close" && run.length >= MIN_AREA_VERTICES) {
        finish(true);
        return;
      }
      addDraftVertex({ x: snap.x, z: snap.z });
    },
    [resolve, addDraftVertex, finish],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!e.point) return;
      setHint(resolve(e.point.x, e.point.z));
    },
    [resolve],
  );

  const onDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      finish(false);
    },
    [finish],
  );

  const liftY = useCallback(
    (x: number, z: number): number => (sampler ? sampler(x, z) : 0) + DRAFT_Y,
    [sampler],
  );

  const geometry = useMemo(() => {
    const vertices = draftSession?.vertices ?? [];
    const tool = draftSession?.tool ?? null;
    const toWorld = (v: WorldXZ): [number, number, number] => [
      v.x,
      liftY(v.x, v.z),
      v.z,
    ];
    const placed = vertices.map(toWorld);
    const cursor = hint ? { x: hint.x, z: hint.z } : null;
    const last = vertices[vertices.length - 1] ?? null;
    const origin = vertices[0] ?? null;
    // Rubber band: last placed vertex → snapped cursor.
    const band = last && cursor ? [toWorld(last), toWorld(cursor)] : null;
    // Area shows the closing leg too, so the ring reads before it closes.
    const closingLeg =
      tool === "area" && origin && cursor && vertices.length >= 2
        ? [toWorld(cursor), toWorld(origin)]
        : null;
    const readout = last && cursor ? segmentReadout(last, cursor) : null;
    const previewRun = cursor ? [...vertices, cursor] : vertices;
    return {
      placed,
      band,
      closingLeg,
      cursor,
      readout,
      runM: draftRunLengthM(previewRun, tool === "area"),
      areaM2: tool === "area" ? draftAreaM2(previewRun) : 0,
    };
  }, [draftSession, hint, liftY]);

  if (!draftSession) return null;

  const planeSize = scaleM * 5;
  const tool = draftSession.tool;
  const toolLabel = tool === "area" ? "Area" : "Polyline";

  return (
    <group>
      {/* Invisible raycast plane — owns pointer capture while a tool is armed. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onDoubleClick={onDoubleClick}
      >
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* The committed run so far — solid Primary Signal Blue linework. */}
      {geometry.placed.length >= 2 && (
        <Line
          points={geometry.placed}
          color={PALETTE.gsPrimary}
          lineWidth={2}
          transparent
          opacity={0.95}
          renderOrder={SPATIAL_LAYER.markers.renderOrder}
        />
      )}

      {/* Rubber band to the snapped cursor — dashed, it is not committed yet. */}
      {geometry.band && (
        <Line
          points={geometry.band}
          color={PALETTE.gsPrimary}
          lineWidth={1.5}
          dashed
          dashSize={0.4}
          gapSize={0.3}
          transparent
          opacity={0.8}
          renderOrder={SPATIAL_LAYER.markers.renderOrder}
        />
      )}

      {/* Area's closing leg — the ring reads as a region before it closes. */}
      {geometry.closingLeg && (
        <Line
          points={geometry.closingLeg}
          color={PALETTE.gsPrimary}
          lineWidth={1}
          dashed
          dashSize={0.25}
          gapSize={0.35}
          transparent
          opacity={0.5}
          renderOrder={SPATIAL_LAYER.markers.renderOrder}
        />
      )}

      {/* Placed vertex discs — the exact points, not an approximation. */}
      {geometry.placed.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={p}>
          <circleGeometry args={[0.28, 18]} />
          <meshBasicMaterial
            color={PALETTE.gsPrimary}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Live readout — length + bearing of the pending segment, following
          the cursor. Both figures derived; nothing is invented. */}
      {geometry.cursor && (
        <Html
          position={[
            geometry.cursor.x,
            liftY(geometry.cursor.x, geometry.cursor.z) + READOUT_LIFT_M,
            geometry.cursor.z,
          ]}
          center
          zIndexRange={cfZPair("spatialAnnotation")}
          style={{ pointerEvents: "none" }}
        >
          <span data-testid="draft-readout" style={readoutStyle}>
            {geometry.readout
              ? `${toolLabel} · ${geometry.readout.lengthM.toFixed(2)} m · ${geometry.readout.bearingDeg.toFixed(0)}°` +
                (tool === "area"
                  ? ` · ${geometry.areaM2.toFixed(1)} m²`
                  : ` · run ${geometry.runM.toFixed(2)} m`)
              : `${toolLabel} · click to place the first vertex`}
          </span>
        </Html>
      )}

      {/* Snap marker — the SAME vocabulary the freehand layer uses. */}
      {hint?.kind && <SnapMarker hint={hint} />}
    </group>
  );
}

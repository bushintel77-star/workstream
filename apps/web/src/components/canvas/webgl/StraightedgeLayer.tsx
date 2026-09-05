"use client";

/**
 * StraightedgeLayer — the Trace ruler as a placed edge (gap-analysis
 * Phase 1, docs/MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md §5).
 *
 * Interaction (tool-gated exactly like the marquee / draft tools, so the
 * pan law holds whenever RULE is not armed):
 *   - RULE armed + drag   place / re-place the edge (live length rides the
 *                         LiveNibReadout channel while the drag forms)
 *   - RULE armed + Esc    cancel the drag, or clear a placed edge
 *   - PEN with an edge    ink within the proximity band projects onto the
 *                         edge (FusedSketchLayer → projectOntoStraightedge);
 *                         the edge stays visible until cleared or replaced
 *
 * The layer renders the edge as ruler furniture — solid line, perpendicular
 * end ticks, metre hash marks and a live length chip — riding the ground
 * plane at the transient-marker clearance. It is a drawing aid, not a sited
 * artifact (straightedge.ts header), so it persists nothing and reconciles
 * with nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { PALETTE } from "../../../styles/colorTokens";
import { cfZPair } from "../cfz";
import type { HeightmapPoint } from "./coordTransform";
import { SPATIAL_LAYER } from "./layerContract";
import {
  formatRulerMetres,
  straightedgeLengthM,
  STRAIGHTEDGE_MIN_LENGTH_M,
  type Straightedge,
} from "./straightedge";
import { useStudioStore } from "./studioStore";
import { createElevationSampler } from "./terrainMath";
import { isTypingTarget } from "./studioShortcuts";

/** The ruler rides the transient-marker clearance like draft geometry. */
const RULER_Y_OFFSET_M = SPATIAL_LAYER.markers.offsetM;

/** End-tick half-length in world metres — the Trace ruler's perpendicular caps. */
const TICK_M = 0.8;

/** Metre hash marks every N metres along the edge (0 = none on short edges). */
const HASH_EVERY_M = 1;

const lengthChipStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--ws-text-xs)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--ws-active)",
  background: "color-mix(in srgb, var(--ws-panel) 82%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ws-active) 40%, transparent)",
  borderRadius: "var(--ws-radius-3)",
  padding: "1px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  transform: "translate(-50%, -50%)",
};

export function StraightedgeLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: {
  scaleM: number;
  boardAspect: number;
  heightmapPoints?: HeightmapPoint[];
}) {
  const straightedgeEdge = useStudioStore((s) => s.straightedgeEdge);
  const activeTool = useStudioStore((s) => s.activeTool);
  const setStraightedgeEdge = useStudioStore((s) => s.setStraightedgeEdge);

  /** The edge currently being dragged — preview only until pointer-up. */
  const [draft, setDraft] = useState<Straightedge | null>(null);
  const draggingRef = useRef(false);
  /** Drag start in world metres — live length without re-reading the store. */
  const dragStartRef = useRef<{ x: number; z: number } | null>(null);

  const armed = activeTool === "straightedge";

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );
  const liftY = useCallback(
    (x: number, z: number): number => (sampler ? sampler(x, z) : 0) + RULER_Y_OFFSET_M,
    [sampler],
  );

  const pctToWorldPts = useCallback(
    (edge: Straightedge): [number, number, number][] => {
      const toWorld = (p: { x: number; y: number }): [number, number, number] => {
        const xM = (p.x / 100) * scaleM - scaleM / 2;
        const zM = (p.y / 100) * (scaleM * boardAspect) - (scaleM * boardAspect) / 2;
        return [xM, liftY(xM, zM), zM];
      };
      return [toWorld(edge.a), toWorld(edge.b)];
    },
    [scaleM, boardAspect, liftY],
  );

  /** Board-% ↔ world metres — the square board (aspect by law) makes the
   *  round trip a single linear scale; kept local so the drag never
   *  re-reads the store mid-gesture. */
  const toPct = useCallback(
    (x: number, z: number) => ({
      x: ((x + scaleM / 2) / scaleM) * 100,
      y: ((z + (scaleM * boardAspect) / 2) / (scaleM * boardAspect)) * 100,
    }),
    [scaleM, boardAspect],
  );

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!armed || !e.point) return;
      e.stopPropagation();
      draggingRef.current = true;
      dragStartRef.current = { x: e.point.x, z: e.point.z };
      const a = toPct(e.point.x, e.point.z);
      setDraft({ a, b: a });
      useStudioStore.getState().setLiveCoord({
        x: e.point.x,
        z: e.point.z,
        rulerM: 0,
      });
    },
    [armed, toPct],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!armed || !draggingRef.current || !e.point) return;
      e.stopPropagation();
      const start = dragStartRef.current;
      const len = start
        ? Math.hypot(e.point.x - start.x, e.point.z - start.z)
        : 0;
      setDraft((prev) => (prev ? { ...prev, b: toPct(e.point.x, e.point.z) } : prev));
      // Live length of the forming edge through the readout channel.
      useStudioStore.getState().setLiveCoord({
        x: e.point.x,
        z: e.point.z,
        rulerM: len,
      });
    },
    [armed, toPct],
  );

  const commitDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (draft) {
      const len = straightedgeLengthM(draft, scaleM, boardAspect);
      // A click is not a ruler — sub-floor drags clear instead of planting
      // a degenerate edge.
      setStraightedgeEdge(len >= STRAIGHTEDGE_MIN_LENGTH_M ? draft : null);
    }
    setDraft(null);
    dragStartRef.current = null;
    // The placement readout ends with the gesture.
    useStudioStore.getState().setLiveCoord(null);
  }, [draft, scaleM, boardAspect, setStraightedgeEdge]);

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!armed) return;
      e.stopPropagation();
      commitDrag();
    },
    [armed, commitDrag],
  );

  // Keyboard: Esc cancels the drag or clears a placed edge (the readout's
  // own quiet window ends with it). Same typing-target guard as the drafts.
  useEffect(() => {
    if (!armed && !straightedgeEdge && !draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTypingTarget(e.target)) return;
      if (draggingRef.current) {
        draggingRef.current = false;
        dragStartRef.current = null;
        setDraft(null);
        useStudioStore.getState().setLiveCoord(null);
      } else if (straightedgeEdge) {
        setStraightedgeEdge(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, straightedgeEdge, draft, setStraightedgeEdge]);

  // All derived geometry is memoized BEFORE any early return — hook order
  // is invariant (the component returns null below when idle).
  const shown = draft ?? straightedgeEdge;
  const pts = useMemo(
    () => (shown ? pctToWorldPts(shown) : []),
    [shown, pctToWorldPts],
  );
  const lengthM = shown ? straightedgeLengthM(shown, scaleM, boardAspect) : 0;
  // Metre hash marks — the ruler reads as calibrated, not just as a line.
  const hashes = useMemo(() => {
    if (!shown || lengthM < HASH_EVERY_M || pts.length < 2) return [];
    const a = pts[0]!;
    const b = pts[1]!;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz);
    if (len === 0) return [];
    // Unit perpendicular in the ground plane.
    const px = -dz / len;
    const pz = dx / len;
    const out: [number, number, number][][] = [];
    for (let m = HASH_EVERY_M; m < len; m += HASH_EVERY_M) {
      const cx = a[0] + dx * (m / len);
      const cz = a[2] + dz * (m / len);
      out.push([
        [cx - px * TICK_M * 0.5, liftY(cx, cz), cz - pz * TICK_M * 0.5],
        [cx + px * TICK_M * 0.5, liftY(cx, cz), cz + pz * TICK_M * 0.5],
      ]);
    }
    return out;
  }, [shown, pts, lengthM, liftY]);

  // End ticks — perpendicular caps at a and b.
  const endTicks = useMemo(() => {
    if (!shown || pts.length < 2) return [];
    const [a, b] = pts;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz);
    if (len === 0) return [];
    const px = -dz / len;
    const pz = dx / len;
    return [a, b].map((p) => [
      [p[0] - px * TICK_M, liftY(p[0], p[2]), p[2] - pz * TICK_M],
      [p[0] + px * TICK_M, liftY(p[0], p[2]), p[2] + pz * TICK_M],
    ] as [number, number, number][]);
  }, [shown, pts, liftY]);

  if (!armed && !straightedgeEdge) return null;

  const planeSize = scaleM * 5;
  const mid = pts.length === 2
    ? {
        x: (pts[0]![0] + pts[1]![0]) / 2,
        z: (pts[0]![2] + pts[1]![2]) / 2,
      }
    : null;

  return (
    <group>
      {/* Invisible raycast plane — owns pointer capture while RULE is armed. */}
      {armed && (
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

      {/* The edge — solid while placed, brighter while being dragged. */}
      {shown && pts.length === 2 && (
        <>
          <Line
            points={pts}
            color={PALETTE.gsPrimary}
            lineWidth={2}
            transparent
            opacity={draft ? 1 : 0.9}
            renderOrder={SPATIAL_LAYER.markers.renderOrder}
          />
          {endTicks.map((tick, i) => (
            <Line
              key={`tick-${i}`}
              points={tick}
              color={PALETTE.gsPrimary}
              lineWidth={2}
              transparent
              opacity={0.9}
              renderOrder={SPATIAL_LAYER.markers.renderOrder}
            />
          ))}
          {hashes.map((hash, i) => (
            <Line
              key={`hash-${i}`}
              points={hash}
              color={PALETTE.gsPrimary}
              lineWidth={1}
              transparent
              opacity={0.6}
              renderOrder={SPATIAL_LAYER.markers.renderOrder}
            />
          ))}
          {mid && (
            <Html
              position={[mid.x, liftY(mid.x, mid.z) + 0.4, mid.z]}
              center
              // The chip is read-only chrome: the WRAPPER must be pointer-
              // transparent too, not just the styled div inside it. A
              // hoverable wrapper eats the canvas' pointermove stream while
              // a stroke crosses the chip — observed in the e2e as ink
              // wandering off-board mid-stroke (2026-09-05).
              style={{ pointerEvents: "none" }}
              zIndexRange={cfZPair("spatialAnnotation")}
            >
              <div style={lengthChipStyle} data-testid="straightedge-length">
                {formatRulerMetres(lengthM)} m
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

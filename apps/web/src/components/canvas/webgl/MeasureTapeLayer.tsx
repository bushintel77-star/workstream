"use client";

/**
 * Gold Standard 2026 — Measure Tape Layer (interactive two-point measurement).
 *
 * The Gap 3 port of the SVG studio's MeasureOverlay: an armed tool where a
 * pointer-down sets the anchor, drag sets the far end, and a live tape
 * reports true metres (aspect-correct via pctToWorld). The tape is EPHEMERAL
 * by design — nothing persists (matching the SVG studio) — and stays until
 * the next press or Esc (Esc also disarms the tool).
 *
 * Interaction: an invisible raycast plane (the FusedSketchLayer /
 * ElevationSliceLine pattern) owns pointer capture while armed. Measure and
 * sketch mode are mutually exclusive (the store setter enforces it; the
 * sketch chip disarms measure and vice versa).
 *
 * Render: draped drei <Line> over the terrain sampler, endpoint discs, and
 * an <Html> constant-px label at the midpoint. A DOM twin readout
 * (MeasureReadoutChip in WebGLStudioPreview) mirrors the figure for
 * accessibility + e2e.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (technical drafting truth)
 */

import { useEffect, useMemo, useRef } from "react";
import { Line, Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "./studioStore";
import {
  pctToWorld,
  worldToPct,
  type PctPoint,
  type HeightmapPoint,
} from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { cfZPair } from "../cfz";

/** Signal Blue — measurement/truth identity (matches the section cut). */
const TRUTH_BLUE = "#0030CF";
/** Tape hover height above the surface (above the ink + dims). */
const TAPE_Y_OFFSET = 0.06;
/** Tape polyline resolution (drape samples between the two ends). */
const TAPE_SAMPLES = 24;

const measureLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--ws-text-xs)",
  fontWeight: 600,
  color: "var(--ws-active)",
  background: "color-mix(in srgb, var(--ws-panel) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ws-active) 35%, transparent)",
  borderRadius: "var(--ws-radius-3)",
  padding: "1px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

export interface MeasureTapeLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — the tape drapes over the same terrain as the ink. */
  heightmapPoints?: HeightmapPoint[];
}

export function MeasureTapeLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: MeasureTapeLayerProps) {
  const measureActive = useStudioStore((s) => s.measureActive);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const tape = useStudioStore((s) => s.measureTape);
  const setMeasureTape = useStudioStore((s) => s.setMeasureTape);
  const setMeasureActive = useStudioStore((s) => s.setMeasureActive);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const draggingRef = useRef(false);
  const anchorRef = useRef<PctPoint | null>(null);

  // Esc disarms the tool AND clears the tape (sticky-tool exit, SVG parity).
  useEffect(() => {
    if (!measureActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMeasureActive(false);
        setMeasureTape(null, null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measureActive, setMeasureActive, setMeasureTape]);

  const toPct = (e: ThreeEvent<PointerEvent>): PctPoint | null => {
    if (!e.point) return null;
    return worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!measureActive || sketchMode) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    anchorRef.current = p;
    setMeasureTape(p, p);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!measureActive || !draggingRef.current || !anchorRef.current) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    setMeasureTape(anchorRef.current, p);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    anchorRef.current = null;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  };

  // Tape geometry (world metres, draped) + length — memo must sit above the
  // early return (hooks are unconditional; it no-ops when there's no tape).
  const tapeGeom = useMemo(() => {
    if (!tape) return null;
    const [ax, az] = pctToWorld(tape.a, scaleM, boardAspect);
    const [bx, bz] = pctToWorld(tape.b, scaleM, boardAspect);
    const lengthM = Math.hypot(bx - ax, bz - az);
    const points: Array<[number, number, number]> = [];
    for (let i = 0; i < TAPE_SAMPLES; i++) {
      const t = i / (TAPE_SAMPLES - 1);
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = (sampler ? sampler(x, z) : 0) + TAPE_Y_OFFSET;
      points.push([x, y, z]);
    }
    const mid = points[Math.floor(TAPE_SAMPLES / 2)]!;
    return {
      points,
      lengthM,
      a: [ax, points[0]![1]!, az] as [number, number, number],
      b: [bx, points[points.length - 1]![1]!, bz] as [number, number, number],
      mid,
    };
  }, [tape, scaleM, boardAspect, sampler]);

  if (!measureActive) return null;

  const planeSize = scaleM * 5;

  return (
    <group>
      {/* Invisible raycast plane — owns pointer capture while the tool is armed */}
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

      {tapeGeom && tapeGeom.lengthM > 0.01 && (
        <group>
          <Line
            points={tapeGeom.points}
            color={TRUTH_BLUE}
            lineWidth={2}
            dashed
            dashSize={0.6}
            gapSize={0.4}
            transparent
            opacity={0.95}
          />
          {/* Endpoint discs */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={tapeGeom.a}>
            <circleGeometry args={[0.35, 20]} />
            <meshBasicMaterial color={TRUTH_BLUE} transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={tapeGeom.b}>
            <circleGeometry args={[0.35, 20]} />
            <meshBasicMaterial color={TRUTH_BLUE} transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <Html
            position={tapeGeom.mid}
            center
            zIndexRange={cfZPair("spatialAnnotation")}
            style={{ pointerEvents: "none" }}
          >
            <span data-testid="measure-label" style={measureLabelStyle}>
              {`${tapeGeom.lengthM.toFixed(2)} m`}
            </span>
          </Html>
        </group>
      )}
    </group>
  );
}

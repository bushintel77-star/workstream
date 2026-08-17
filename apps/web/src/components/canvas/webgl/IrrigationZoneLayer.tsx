"use client";

/**
 * Gold Standard 2026 — Irrigation Zone Layer (drawable watering zones).
 *
 * Direct-manipulation sibling of the trench tool: when `zoneTool` is armed,
 * an invisible raycast plane owns pointer capture and a drag traces a ring
 * that closes into a polygon and commits as an `IrrigationZone` on release.
 * Committed zones render as filled, draped rings with a per-kind stroke; the
 * live draft shows its area (m²) and estimated flow (L/h).
 *
 * Mutual exclusion: arming the zone tool disarms sketch/measure/asset/trench
 * (store-enforced both ways). Esc disarms + clears the draft.
 */

import { useEffect, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { IrrigationZoneKind } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import {
  pctToWorld,
  worldToPct,
  type PctPoint,
} from "./coordTransform";
import {
  buildTracedZone,
  closeZonePolygon,
  estimateZoneFlowLph,
  shouldAppendZonePoint,
  zoneAreaM2,
  type ZonePointPct,
} from "./irrigationZonePath";

/** Per-kind stroke — mirrors the handoff irrigation zone vocabulary. */
const ZONE_COLOR: Record<IrrigationZoneKind, string> = {
  drip: PALETTE.sproutL500,
  spray: PALETTE.waterL500,
  lighting: PALETTE.grayL500,
  lighting_conduit: PALETTE.grayL400,
  agg_drain: PALETTE.waterL500,
};

/** Zone ring hover height above the surface (above trenches + ink). */
const ZONE_Y_OFFSET = 0.07;

const zoneLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--gs-ink)",
  background: "color-mix(in srgb, var(--gs-glass) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  borderRadius: 6,
  padding: "1px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

function makeZoneId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Flat world-space ring for a %-space polygon (vertex-level). */
function ringWorld(
  pts: ZonePointPct[],
  scaleM: number,
  boardAspect: number,
): Array<[number, number, number]> {
  const closed = closeZonePolygon(pts);
  return closed.map((p) => {
    const [wx, wz] = pctToWorld(p, scaleM, boardAspect);
    return [wx, ZONE_Y_OFFSET, wz];
  });
}

/** THREE.Shape from world ring points (for the flat polygon fill). */
function ringShape(
  pts: ZonePointPct[],
  scaleM: number,
  boardAspect: number,
): THREE.Shape | null {
  const closed = closeZonePolygon(pts);
  if (closed.length < 3) return null;
  const shape = new THREE.Shape();
  const [sx, sz] = pctToWorld(closed[0]!, scaleM, boardAspect);
  shape.moveTo(sx, sz);
  for (let i = 1; i < closed.length; i++) {
    const [x, z] = pctToWorld(closed[i]!, scaleM, boardAspect);
    shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

export interface IrrigationZoneLayerProps {
  scaleM: number;
  boardAspect: number;
}

export function IrrigationZoneLayer({
  scaleM,
  boardAspect,
}: IrrigationZoneLayerProps) {
  const zoneTool = useStudioStore((s) => s.zoneTool);
  const zoneDraft = useStudioStore((s) => s.zoneDraft);
  const irrigationZones = useStudioStore((s) => s.irrigationZones);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const setZoneTool = useStudioStore((s) => s.setZoneTool);
  const setZoneDraft = useStudioStore((s) => s.setZoneDraft);
  const addIrrigationZone = useStudioStore((s) => s.addIrrigationZone);

  const draggingRef = useRef(false);
  const pointsRef = useRef<ZonePointPct[]>([]);

  // Esc disarms + clears the draft (sticky-tool exit, trench-tool parity).
  useEffect(() => {
    if (!zoneTool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoneTool(null);
        setZoneDraft(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoneTool, setZoneTool, setZoneDraft]);

  const toPct = (e: ThreeEvent<PointerEvent>): PctPoint | null => {
    if (!e.point) return null;
    return worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!zoneTool || sketchMode) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    pointsRef.current = [{ x: p.x, y: p.y }];
    setZoneDraft({ kind: zoneTool, points: pointsRef.current });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current || !zoneTool) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (last && shouldAppendZonePoint(last, { x: p.x, y: p.y })) {
      pointsRef.current = [...pointsRef.current, { x: p.x, y: p.y }];
      setZoneDraft({ kind: zoneTool, points: pointsRef.current });
    }
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    if (!zoneTool || points.length < 3) {
      setZoneDraft(null); // abandon a stray tap or an open line
      return;
    }
    addIrrigationZone(
      buildTracedZone({
        id: makeZoneId(),
        name: zoneTool === "spray" ? "Spray zone" : "Drip zone",
        kind: zoneTool,
        points,
      }),
    );
  };

  const draftAreaM2 =
    zoneDraft && zoneDraft.points.length >= 3
      ? zoneAreaM2(zoneDraft.points, scaleM, boardAspect)
      : 0;
  const draftFlowLph =
    zoneDraft && zoneDraft.points.length >= 3
      ? estimateZoneFlowLph(zoneDraft.points, 30, 2, scaleM, boardAspect)
      : 0;
  const draftWorld = zoneDraft
    ? ringWorld(zoneDraft.points, scaleM, boardAspect)
    : null;
  const draftShape =
    zoneDraft && zoneDraft.points.length >= 3
      ? ringShape(zoneDraft.points, scaleM, boardAspect)
      : null;
  const draftLast = draftWorld ? draftWorld[draftWorld.length - 1] : null;

  return (
    <group>
      {/* Committed zones — flat filled rings + per-kind strokes. */}
      {irrigationZones.map((z) => {
        const pts = z.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
        const shape = ringShape(pts, scaleM, boardAspect);
        if (!shape) return null;
        return (
          <group key={z.id}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ZONE_Y_OFFSET - 0.01, 0]}>
              <shapeGeometry args={[shape]} />
              <meshBasicMaterial
                color={ZONE_COLOR[z.kind]}
                transparent
                opacity={0.14}
                depthWrite={false}
              />
            </mesh>
            <Line
              points={ringWorld(pts, scaleM, boardAspect)}
              color={ZONE_COLOR[z.kind]}
              lineWidth={1.4}
              dashed
              dashSize={0.5}
              gapSize={0.35}
              transparent
              opacity={0.85}
            />
          </group>
        );
      })}

      {zoneTool && (
        <>
          {/* Invisible raycast plane — owns pointer capture while armed. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <planeGeometry args={[scaleM * 5, scaleM * 5]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {zoneDraft && draftWorld && draftShape && draftWorld.length >= 3 && (
            <group>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ZONE_Y_OFFSET - 0.01, 0]}>
                <shapeGeometry args={[draftShape]} />
                <meshBasicMaterial
                  color={ZONE_COLOR[zoneDraft.kind]}
                  transparent
                  opacity={0.2}
                  depthWrite={false}
                />
              </mesh>
              <Line
                points={draftWorld}
                color={ZONE_COLOR[zoneDraft.kind]}
                lineWidth={2}
                dashed
                dashSize={0.5}
                gapSize={0.35}
                transparent
                opacity={0.95}
              />
              {draftLast && (
                <Html
                  position={draftLast}
                  center
                  zIndexRange={[20, 10]}
                  style={{ pointerEvents: "none" }}
                >
                  <span data-testid="zone-draft-label" style={zoneLabelStyle}>
                    {zoneDraft.kind} · {draftAreaM2.toFixed(1)} m² · {draftFlowLph.toFixed(0)} L/h
                  </span>
                </Html>
              )}
            </group>
          )}
        </>
      )}
    </group>
  );
}

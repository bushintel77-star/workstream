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
 * Kind `lighting` is the lighting-runs tool: the same capture but an OPEN
 * path (a run, not a ring) that commits with `fixture_spacing_m` + `wire_gauge`
 * and renders with fixture dots; the draft shows run length (m) + fixture
 * count instead of area/flow.
 *
 * Mutual exclusion: arming the zone tool disarms sketch/measure/asset/trench
 * (store-enforced both ways). Esc disarms + clears the draft.
 */

import { useEffect, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { IrrigationZoneKind } from "@workstream/contracts";
import { getLayerStyle, layerYOffset, type LayerID } from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { cfZPair } from "../cfz";
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
import {
  buildTracedLightingRun,
  DEFAULT_LIGHTING_FIXTURE_SPACING_M,
  fixtureCountForRun,
  fixturePositionsWorld,
  lightingRunLengthM,
  shouldAppendLightingPoint,
  type LightingPointPct,
} from "./lightingPath";

/**
 * IrrigationZoneKind → Domain Layer Registry id. The registry is the style
 * authority (color / metric dash / y-bias); drip/spray/agg-drain share the
 * irrigation-main layer, lighting runs ride the low-voltage layer.
 */
const ZONE_LAYER: Record<IrrigationZoneKind, LayerID> = {
  drip: "civil.irrigation_main",
  spray: "civil.irrigation_main",
  agg_drain: "civil.irrigation_main",
  lighting: "civil.lighting_low_volt",
  lighting_conduit: "civil.lighting_low_volt",
};

function zoneLayerId(kind: IrrigationZoneKind): LayerID {
  return ZONE_LAYER[kind] ?? "civil.irrigation_main";
}

function zoneStyle(kind: IrrigationZoneKind) {
  return getLayerStyle(zoneLayerId(kind));
}

const zoneLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-sm)",
  fontWeight: 600,
  color: "var(--gs-ink)",
  background: "color-mix(in srgb, var(--gs-glass) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  borderRadius: "var(--gs-radius-md)",
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
  offsetM: number,
): Array<[number, number, number]> {
  const closed = closeZonePolygon(pts);
  return closed.map((p) => {
    const [wx, wz] = pctToWorld(p, scaleM, boardAspect);
    return [wx, offsetM, wz];
  });
}

/** Flat world-space polyline for an OPEN run (lighting — never closed). */
function openWorld(
  pts: LightingPointPct[],
  scaleM: number,
  boardAspect: number,
  offsetM: number,
): Array<[number, number, number]> {
  return pts.map((p) => {
    const [wx, wz] = pctToWorld(p, scaleM, boardAspect);
    return [wx, offsetM, wz];
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
    const next = { x: p.x, y: p.y };
    const appendable =
      zoneTool === "lighting"
        ? last && shouldAppendLightingPoint(last, next)
        : last && shouldAppendZonePoint(last, next);
    if (appendable) {
      pointsRef.current = [...pointsRef.current, next];
      setZoneDraft({ kind: zoneTool, points: pointsRef.current });
    }
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    const minPoints = zoneTool === "lighting" ? 2 : 3;
    if (!zoneTool || points.length < minPoints) {
      setZoneDraft(null); // abandon a stray tap or an open line
      return;
    }
    if (zoneTool === "lighting") {
      addIrrigationZone(
        buildTracedLightingRun({
          id: makeZoneId(),
          name: "Lighting run",
          points,
        }),
      );
    } else {
      addIrrigationZone(
        buildTracedZone({
          id: makeZoneId(),
          name: zoneTool === "spray" ? "Spray zone" : "Drip zone",
          kind: zoneTool,
          points,
        }),
      );
    }
  };

  const isLightingDraft = zoneDraft?.kind === "lighting";
  const draftAreaM2 =
    zoneDraft && zoneDraft.points.length >= 3
      ? zoneAreaM2(zoneDraft.points, scaleM, boardAspect)
      : 0;
  const draftFlowLph =
    zoneDraft && zoneDraft.points.length >= 3
      ? estimateZoneFlowLph(zoneDraft.points, 30, 2, scaleM, boardAspect)
      : 0;
  const draftLightingLengthM =
    isLightingDraft && zoneDraft && zoneDraft.points.length >= 2
      ? lightingRunLengthM(zoneDraft.points, scaleM, boardAspect)
      : 0;
  const draftFixtures =
    isLightingDraft && zoneDraft
      ? fixtureCountForRun(draftLightingLengthM, DEFAULT_LIGHTING_FIXTURE_SPACING_M)
      : 0;
  const draftWorld = zoneDraft
    ? isLightingDraft
      ? openWorld(
          zoneDraft.points,
          scaleM,
          boardAspect,
          layerYOffset(zoneLayerId(zoneDraft.kind)),
        )
      : ringWorld(
          zoneDraft.points,
          scaleM,
          boardAspect,
          layerYOffset(zoneLayerId(zoneDraft.kind)),
        )
    : null;
  const draftShape =
    !isLightingDraft && zoneDraft && zoneDraft.points.length >= 3
      ? ringShape(zoneDraft.points, scaleM, boardAspect)
      : null;
  const draftLast = draftWorld ? draftWorld[draftWorld.length - 1] : null;

  return (
    <group>
      {/* Committed zones — lighting runs as open paths + fixture dots; the
          rest as flat filled rings + per-kind strokes. */}
      {irrigationZones.map((z) => {
        const pts = z.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
        if (z.kind === "lighting") {
          const style = zoneStyle(z.kind);
          return (
            <group key={z.id}>
              <Line
                points={openWorld(
                  pts,
                  scaleM,
                  boardAspect,
                  layerYOffset(zoneLayerId(z.kind)),
                )}
                color={style.color}
                lineWidth={style.lineWidthPx}
                dashed
                dashSize={style.dashArray?.[0] ?? 1}
                gapSize={style.dashArray?.[1] ?? 0.5}
                transparent
                opacity={style.opacity}
              />
              {fixturePositionsWorld(
                pts,
                z.fixture_spacing_m ?? DEFAULT_LIGHTING_FIXTURE_SPACING_M,
                scaleM,
                boardAspect,
              ).map(([fx, fz], i) => (
                <mesh
                  key={i}
                  position={[fx, layerYOffset(zoneLayerId(z.kind)) + 0.02, fz]}
                >
                  <sphereGeometry args={[0.14, 12, 12]} />
                  <meshBasicMaterial color={PALETTE.windowGlow} />
                </mesh>
              ))}
            </group>
          );
        }
        const shape = ringShape(pts, scaleM, boardAspect);
        if (!shape) return null;
        const style = zoneStyle(z.kind);
        return (
          <group key={z.id}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, layerYOffset(zoneLayerId(z.kind)) - 0.01, 0]}
            >
              <shapeGeometry args={[shape]} />
              <meshBasicMaterial
                color={style.color}
                transparent
                opacity={0.14}
                depthWrite={false}
              />
            </mesh>
            <Line
              points={ringWorld(
                pts,
                scaleM,
                boardAspect,
                layerYOffset(zoneLayerId(z.kind)),
              )}
              color={style.color}
              lineWidth={style.lineWidthPx}
              dashed
              dashSize={style.dashArray?.[0] ?? 1}
              gapSize={style.dashArray?.[1] ?? 0.5}
              transparent
              opacity={style.opacity}
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

          {zoneDraft && draftWorld && (isLightingDraft ? draftWorld.length >= 2 : draftShape != null) && (
            <group>
              {draftShape && (
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[
                    0,
                    layerYOffset(zoneLayerId(zoneDraft.kind)) - 0.01,
                    0,
                  ]}
                >
                  <shapeGeometry args={[draftShape]} />
                  <meshBasicMaterial
                    color={zoneStyle(zoneDraft.kind).color}
                    transparent
                    opacity={0.2}
                    depthWrite={false}
                  />
                </mesh>
              )}
              <Line
                points={draftWorld}
                color={zoneStyle(zoneDraft.kind).color}
                lineWidth={2}
                dashed
                dashSize={zoneStyle(zoneDraft.kind).dashArray?.[0] ?? 1}
                gapSize={zoneStyle(zoneDraft.kind).dashArray?.[1] ?? 0.5}
                transparent
                opacity={0.95}
              />
              {draftLast && (
                <Html
                  position={draftLast}
                  center
                  zIndexRange={cfZPair("spatialAnnotation")}
                  style={{ pointerEvents: "none" }}
                >
                  <span data-testid="zone-draft-label" style={zoneLabelStyle}>
                    {isLightingDraft
                      ? `lighting · ${draftLightingLengthM.toFixed(1)} m · ${draftFixtures} fixture${draftFixtures === 1 ? "" : "s"}`
                      : `${zoneDraft.kind} · ${draftAreaM2.toFixed(1)} m² · ${draftFlowLph.toFixed(0)} L/h`}
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

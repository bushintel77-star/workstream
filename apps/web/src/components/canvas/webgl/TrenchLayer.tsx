"use client";

/**
 * Gold Standard 2026 — Trench Trace Layer (drawable construction runs).
 *
 * The direct-manipulation half of the trench tool: when `trenchTool` is armed,
 * an invisible raycast plane owns pointer capture (the MeasureTapeLayer /
 * ElevationSliceLine pattern) and a drag traces a polyline that commits as a
 * `ConstructionTrench{source:"traced"}` on release. Committed runs render as
 * draped, per-kind dashed lines; the live draft shows its running length and
 * tints crimson while it enters a no-dig ring (easement / TPZ / utility).
 *
 * Mutual exclusion: arming the trench tool disarms sketch/measure/asset (the
 * store setter enforces it). Esc disarms + clears the draft.
 */

import { useEffect, useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { ConstructionTrenchKind } from "@workstream/contracts";
import { trenchKindLabel } from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import {
  pctToWorld,
  worldToPct,
  type HeightmapPoint,
  type PctPoint,
} from "./coordTransform";
import { useStudioStore } from "./studioStore";
import { createElevationSampler } from "./terrainMath";
import {
  buildTracedTrench,
  shouldAppendTrenchPoint,
  trenchConflictsWithRings,
  type TrenchPointPct,
} from "./trenchPath";

/** Per-kind stroke — mirrors the handoff TrenchOverlay STROKE mapping. */
const TRENCH_COLOR: Record<ConstructionTrenchKind, string> = {
  irrig_main: PALETTE.hedgeL600,
  irrig_lateral: PALETTE.sproutL500,
  lighting_conduit: PALETTE.grayL500,
  drainage: PALETTE.waterL500,
};

/** Per-kind dash signature — first pair of the handoff DASH_LIVE patterns. */
const TRENCH_DASH: Record<ConstructionTrenchKind, { dash: number; gap: number }> = {
  irrig_main: { dash: 3, gap: 0.8 },
  irrig_lateral: { dash: 1.2, gap: 0.9 },
  lighting_conduit: { dash: 1.6, gap: 0.8 },
  drainage: { dash: 2.4, gap: 0.7 },
};

/** Hover height above the surface (above ink + dims). */
const TRENCH_Y_OFFSET = 0.05;
/** Strike crimson — the conflict signal on the live draft. */
const CONFLICT_COLOR = "#C41E1E";

function makeTrenchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Drape a %-space polyline onto the terrain (vertex-level samples). */
function drapePolyline(
  pts: TrenchPointPct[],
  sampler: ((x: number, z: number) => number) | null,
  scaleM: number,
  boardAspect: number,
  offsetM: number,
): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const p of pts) {
    const [wx, wz] = pctToWorld(p, scaleM, boardAspect);
    const y = (sampler ? sampler(wx, wz) : 0) + offsetM;
    out.push([wx, y, wz]);
  }
  return out;
}

/** World-space polyline length in metres (aspect-correct). */
function worldLengthM(
  pts: TrenchPointPct[],
  scaleM: number,
  boardAspect: number,
): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pctToWorld(pts[i - 1]!, scaleM, boardAspect);
    const [bx, bz] = pctToWorld(pts[i]!, scaleM, boardAspect);
    len += Math.hypot(bx - ax, bz - az);
  }
  return len;
}

const draftLabelStyle: React.CSSProperties = {
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

export interface TrenchLayerProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints?: HeightmapPoint[];
  /** Closed no-dig rings in board-% (easements / TPZ / utility corridors). */
  noDigRingsPct?: PctPoint[][];
}

export function TrenchLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
  noDigRingsPct = [],
}: TrenchLayerProps) {
  const trenchTool = useStudioStore((s) => s.trenchTool);
  const trenchDraft = useStudioStore((s) => s.trenchDraft);
  const constructionTrenches = useStudioStore((s) => s.constructionTrenches);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const setTrenchTool = useStudioStore((s) => s.setTrenchTool);
  const setTrenchDraft = useStudioStore((s) => s.setTrenchDraft);
  const addConstructionTrench = useStudioStore((s) => s.addConstructionTrench);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const draggingRef = useRef(false);
  const pointsRef = useRef<TrenchPointPct[]>([]);

  // Esc disarms + clears the draft (sticky-tool exit, measure-tape parity).
  useEffect(() => {
    if (!trenchTool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTrenchTool(null);
        setTrenchDraft(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trenchTool, setTrenchTool, setTrenchDraft]);

  const noDig = useMemo(
    () => noDigRingsPct.map((r) => r.map((p) => ({ x: p.x, y: p.y }))),
    [noDigRingsPct],
  );

  const toPct = (e: ThreeEvent<PointerEvent>): PctPoint | null => {
    if (!e.point) return null;
    return worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!trenchTool || sketchMode) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    pointsRef.current = [{ x: p.x, y: p.y }];
    setTrenchDraft({ kind: trenchTool, points: pointsRef.current });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current || !trenchTool) return;
    e.stopPropagation();
    const p = toPct(e);
    if (!p) return;
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (last && shouldAppendTrenchPoint(last, { x: p.x, y: p.y })) {
      pointsRef.current = [...pointsRef.current, { x: p.x, y: p.y }];
      setTrenchDraft({ kind: trenchTool, points: pointsRef.current });
    }
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    const points = pointsRef.current;
    pointsRef.current = [];
    if (!trenchTool || points.length < 2) {
      setTrenchDraft(null); // abandon a stray tap
      return;
    }
    addConstructionTrench(
      buildTracedTrench({
        id: makeTrenchId(),
        name: trenchKindLabel(trenchTool),
        kind: trenchTool,
        points,
        why: "Traced by operator on canvas",
      }),
    );
  };

  const draftConflict = trenchDraft
    ? trenchConflictsWithRings(trenchDraft.points, noDig)
    : false;
  const draftLengthM =
    trenchDraft && trenchDraft.points.length >= 2
      ? worldLengthM(trenchDraft.points, scaleM, boardAspect)
      : 0;
  const draftWorld = trenchDraft
    ? drapePolyline(
        trenchDraft.points,
        sampler,
        scaleM,
        boardAspect,
        TRENCH_Y_OFFSET + 0.02,
      )
    : null;
  const draftLast = draftWorld ? draftWorld[draftWorld.length - 1] : null;

  return (
    <group>
      {/* Committed runs — draped, per-kind dashed lines. */}
      {constructionTrenches.map((t) => {
        const pts = t.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
        const world = drapePolyline(pts, sampler, scaleM, boardAspect, TRENCH_Y_OFFSET);
        if (world.length < 2) return null;
        const dash = TRENCH_DASH[t.kind];
        return (
          <Line
            key={t.id}
            points={world}
            color={TRENCH_COLOR[t.kind]}
            lineWidth={1.6}
            dashed
            dashSize={dash.dash}
            gapSize={dash.gap}
            transparent
            opacity={0.9}
          />
        );
      })}

      {trenchTool && (
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

          {trenchDraft && draftWorld && draftWorld.length >= 2 && (
            <group>
              <Line
                points={draftWorld}
                color={
                  draftConflict
                    ? CONFLICT_COLOR
                    : TRENCH_COLOR[trenchDraft.kind]
                }
                lineWidth={2}
                dashed
                dashSize={TRENCH_DASH[trenchDraft.kind].dash}
                gapSize={TRENCH_DASH[trenchDraft.kind].gap}
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
                  <span data-testid="trench-draft-label" style={draftLabelStyle}>
                    {trenchKindLabel(trenchDraft.kind)} · {draftLengthM.toFixed(2)} m
                    {draftConflict ? " · strike" : ""}
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

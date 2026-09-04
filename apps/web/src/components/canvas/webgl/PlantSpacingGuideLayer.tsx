"use client";

/**
 * Gold Standard 2026 — Plant Spacing Guides (mature-footprint preview).
 *
 * Overlap has to be visible BEFORE the commit, so while a symbol is armed and
 * the operator is dragging a row or an area — and while a single placement is
 * selected — this layer draws the mature canopy footprint: one hairline circle
 * per pending stem at the catalog spread (radius = spread / 2), the run line
 * for a row, and a constant-px readout of the stem count and the realised
 * centre-to-centre spacing in metres.
 *
 * Honesty rules:
 *   - The footprint is the MATURE spread from the catalog. Growth is already
 *     modelled once (growthYear → growthFactor drives the scene); a second
 *     growth curve here would be an invented model, so the guide shows the
 *     mature figure and says so.
 *   - Symbols with no catalogued spread get no circle — the count and spacing
 *     still read, but no radius is fabricated.
 *   - Everything here is ephemeral preview. The source is `assetPlantDraft`
 *     (not in the history snapshot, not in the autosave payload); nothing this
 *     layer draws can reach the persisted document.
 *
 * Per-frame state is read via `useStudioStore.getState()` inside useFrame —
 * the layer only consumes the zoom-band alpha there, exactly as SceneItems
 * does, so the guides fade with the placement graphics at macro zoom.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { layerScaleAlpha, viewScaleRatioForZoom } from "./layerPolicy";
import {
  gridInBox,
  massPlantSpacingM,
  matureCanopyRadiusM,
  rowAlongLine,
  rowSpacingM,
} from "./fillAreaAssets";
import { cfZPair } from "../cfz";

/** Guides float just above the ink so they read over beds and paving. */
const GUIDE_Y = 0.07;
/** Circle stroke thickness as a fraction of the canopy radius. */
const RING_THICKNESS = 0.035;

/** Only living things have a MATURE spread; hardscape has a footprint. */
const PLANT_TYPES = new Set(["canopy", "feature", "hedge", "bed", "lawn", "exist"]);

function isPlantSymbol(symbolId: string): boolean {
  return PLANT_TYPES.has(mapSymbolToStudioType(symbolId));
}

const readoutStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--ws-text-xs)",
  fontWeight: 600,
  color: "var(--ws-ink)",
  background: "color-mix(in srgb, var(--ws-panel) 82%, transparent)",
  border: "1px solid color-mix(in srgb, var(--ws-line) 60%, transparent)",
  borderRadius: "var(--ws-radius-3)",
  padding: "1px 8px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

export interface PlantSpacingGuideLayerProps {
  scaleM: number;
  boardAspect: number;
}

interface GuideModel {
  points: PctPoint[];
  radiusM: number | null;
  readout: string;
  /** What the circle represents, appended to the readout. */
  footprintNote: string;
  /** Run endpoints in board-% for the row line; null for area / selection. */
  run: { a: PctPoint; b: PctPoint } | null;
  anchor: PctPoint;
}

function draftGuide(
  draft: { mode: "row" | "area"; a: PctPoint; b: PctPoint },
  symbolId: string,
  scaleM: number,
  boardAspect: number,
): GuideModel {
  const spacing = massPlantSpacingM(symbolId);
  const points =
    draft.mode === "row"
      ? rowAlongLine(draft.a, draft.b, spacing, scaleM, boardAspect)
      : gridInBox(draft.a, draft.b, spacing, scaleM, boardAspect);
  const stems = `${points.length} stem${points.length === 1 ? "" : "s"}`;
  const readout =
    draft.mode === "row"
      ? `${stems} · ${rowSpacingM(draft.a, draft.b, points.length, scaleM, boardAspect).toFixed(2)} m centres`
      : `${stems} · ${spacing.toFixed(2)} m grid`;
  const radiusM = matureCanopyRadiusM(symbolId);
  return {
    points,
    radiusM,
    readout,
    footprintNote:
      radiusM == null
        ? " · no catalogued spread"
        : isPlantSymbol(symbolId)
          ? " · mature spread"
          : " · catalog footprint",
    run: draft.mode === "row" ? { a: draft.a, b: draft.b } : null,
    anchor: draft.b,
  };
}

export function PlantSpacingGuideLayer({
  scaleM,
  boardAspect,
}: PlantSpacingGuideLayerProps) {
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const draft = useStudioStore((s) => s.assetPlantDraft);
  const selection = useStudioStore((s) => s.selection);
  const placements = useStudioStore((s) => s.placements);

  const guide = useMemo<GuideModel | null>(() => {
    if (draft && armedSymbolId) {
      return draftGuide(draft, armedSymbolId, scaleM, boardAspect);
    }
    // One selected placement — show what it will occupy at maturity.
    if (selection.length !== 1 || selection[0]!.kind !== "placement") return null;
    const placement = placements.find((p) => p.id === selection[0]!.id);
    if (!placement) return null;
    const base = matureCanopyRadiusM(placement.symbol_id);
    if (base == null) return null;
    const radiusM = base * Math.max(0.05, placement.scale);
    const pct = { x: placement.x_pct, y: placement.y_pct };
    const plant = isPlantSymbol(placement.symbol_id);
    return {
      points: [pct],
      radiusM,
      readout: `${plant ? "Mature spread" : "Footprint"} ${(radiusM * 2).toFixed(1)} m`,
      footprintNote: "",
      run: null,
      anchor: pct,
    };
  }, [draft, armedSymbolId, selection, placements, scaleM, boardAspect]);

  const groupRef = useRef<THREE.Group>(null);

  // Same scale-band veil the placement graphics use — read transiently so a
  // zoom gesture never re-renders this layer.
  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;
    const alpha = layerScaleAlpha(
      "plantSymbol",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    grp.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as
        | THREE.MeshBasicMaterial
        | undefined;
      if (!mat || !mat.transparent) return;
      const base = mat.userData.spacingGuideBase as number | undefined;
      if (base === undefined) mat.userData.spacingGuideBase = mat.opacity;
      mat.opacity = (mat.userData.spacingGuideBase as number) * alpha;
    });
  });

  if (!guide) return null;

  const [ax, az] = pctToWorld(guide.anchor, scaleM, boardAspect);
  const runPoints = guide.run
    ? [guide.run.a, guide.run.b].map((p) => {
        const [x, z] = pctToWorld(p, scaleM, boardAspect);
        return [x, GUIDE_Y, z] as [number, number, number];
      })
    : null;
  const ringOuter = guide.radiusM;
  const ringInner =
    ringOuter == null
      ? null
      : Math.max(0.02, ringOuter * (1 - RING_THICKNESS) - 0.01);

  return (
    <group ref={groupRef}>
      {runPoints && (
        <Line
          points={runPoints}
          color={PALETTE.gsPrimary}
          lineWidth={1.5}
          dashed
          dashSize={0.5}
          gapSize={0.35}
          transparent
          opacity={0.7}
        />
      )}
      {guide.points.map((p, i) => {
        const [x, z] = pctToWorld(p, scaleM, boardAspect);
        return (
          <group key={`${x.toFixed(3)}:${z.toFixed(3)}:${i}`}>
            {ringOuter != null && ringInner != null && (
              <mesh position={[x, GUIDE_Y, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[ringInner, ringOuter, 48]} />
                <meshBasicMaterial
                  color={PALETTE.sproutL500}
                  transparent
                  opacity={0.75}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            <mesh position={[x, GUIDE_Y, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 12]} />
              <meshBasicMaterial
                color={PALETTE.sproutL500}
                transparent
                opacity={0.9}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
      <Html
        position={[ax, GUIDE_Y + 0.05, az]}
        center
        zIndexRange={cfZPair("spatialAnnotation")}
        style={{ pointerEvents: "none" }}
      >
        <span data-testid="plant-spacing-readout" style={readoutStyle}>
          {guide.readout}
          {guide.footprintNote}
        </span>
      </Html>
    </group>
  );
}

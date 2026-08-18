"use client";

/**
 * Gold Standard 2026 — Landscape Feature Layer (converted CAD linework).
 *
 * Renders `DesignCanvas.features` as draped CAD linework in the fused
 * studio. Mirrored polygon features (accepted deck/lawn/bed proposals whose
 * id mirrors a placement) render through the placement meshes — this layer
 * draws the ORPHANS: LineString features (ditch / path / wall) and polygons
 * with no placement mirror (direct-converted beds), so nothing double-draws.
 *
 * Selected features overlay a thicker Signal Blue line — the same selection
 * state the placements and photo-trace strokes use (selectionPick.ts).
 */

import { useMemo, useRef, type ElementRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { LandscapeFeature } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { pctToWorld, type HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";

/** Linework offset above the surface (draped layer clearance). */
const FEATURE_Y = 0.03;

const LAYER_COLORS: Record<string, string> = {
  hardscape: PALETTE.gsInk,
  structure: PALETTE.gsInk,
  irrigation: PALETTE.cadWater,
  softscape_beds: PALETTE.summerGreen,
  other: PALETTE.gsInk,
};

export interface FeatureLayerProps {
  scaleM: number;
  boardAspect: number;
  /** Spot levels — when present, linework drapes over the terrain. */
  heightmapPoints?: HeightmapPoint[];
}

export function FeatureLayer({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: FeatureLayerProps) {
  const features = useStudioStore((s) => s.features);
  const placements = useStudioStore((s) => s.placements);
  const selection = useStudioStore((s) => s.selection);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const placementIds = useMemo(
    () => new Set(placements.map((p) => p.id)),
    [placements],
  );
  const orphanFeatures = useMemo(
    () =>
      features.filter(
        (f) => f.geometry.type === "LineString" || !placementIds.has(f.id),
      ),
    [features, placementIds],
  );
  const selectedIds = useMemo(
    () =>
      new Set(
        selection.filter((r) => r.kind === "feature").map((r) => r.id),
      ),
    [selection],
  );

  return (
    <group>
      {orphanFeatures.map((f) => (
        <FeatureLine
          key={f.id}
          feature={f}
          scaleM={scaleM}
          boardAspect={boardAspect}
          sampler={sampler}
          selected={selectedIds.has(f.id)}
        />
      ))}
    </group>
  );
}

function FeatureLine({
  feature,
  scaleM,
  boardAspect,
  sampler,
  selected,
}: {
  feature: LandscapeFeature;
  scaleM: number;
  boardAspect: number;
  sampler: ((x: number, z: number) => number) | null;
  selected: boolean;
}) {
  const closed = feature.geometry.type === "Polygon";
  const basePoints = useMemo(() => {
    const pts = feature.geometry.points.map((v) => {
      const [x, z] = pctToWorld(
        { x: v.pct.x_pct, y: v.pct.y_pct },
        scaleM,
        boardAspect,
      );
      return [x, FEATURE_Y, z] as [number, number, number];
    });
    if (closed && pts.length >= 3) pts.push([...pts[0]!]);
    return pts;
  }, [feature.geometry, scaleM, boardAspect, closed]);

  const lineRef = useRef<ElementRef<typeof Line>>(null);
  const overlayRef = useRef<ElementRef<typeof Line>>(null);
  const scratch = useMemo(
    () => new Float32Array(Math.max(basePoints.length, 2) * 3),
    [basePoints.length],
  );

  useFrame(() => {
    if (basePoints.length < 2) return;
    const { viewBlend } = useStudioStore.getState();
    if (!sampler || viewBlend < 0.001) return;
    for (let i = 0; i < basePoints.length; i++) {
      const [x, , z] = basePoints[i]!;
      const y = FEATURE_Y + viewBlend * sampler(x, z);
      scratch[i * 3] = x;
      scratch[i * 3 + 1] = y;
      scratch[i * 3 + 2] = z;
    }
    if (lineRef.current) {
      lineRef.current.geometry.setPositions(scratch.subarray(0, basePoints.length * 3));
      lineRef.current.computeLineDistances();
    }
    if (overlayRef.current) {
      overlayRef.current.geometry.setPositions(scratch.subarray(0, basePoints.length * 3));
      overlayRef.current.computeLineDistances();
    }
  });

  if (basePoints.length < 2) return null;

  const color = LAYER_COLORS[feature.metadata.layer] ?? PALETTE.gsInk;
  return (
    <group>
      <Line
        ref={lineRef}
        points={basePoints}
        color={color}
        lineWidth={2.5}
        opacity={0.9}
        transparent
      />
      {selected && (
        <Line
          ref={overlayRef}
          points={basePoints}
          color={PALETTE.gsPrimary}
          lineWidth={4.5}
          transparent
          opacity={1}
        />
      )}
    </group>
  );
}

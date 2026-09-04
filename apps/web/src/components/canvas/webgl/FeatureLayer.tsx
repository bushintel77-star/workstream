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
import {
  getLayerStyle,
  layerYOffset,
  type LayerID,
} from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { layerScaleAlpha, viewScaleRatioForZoom } from "./layerPolicy";
import { pctToWorld, type HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";

/**
 * Feature metadata.layer → canonical Domain Layer Registry id. The registry
 * is the single source for stroke color + y-bias — no per-component hex.
 */
const FEATURE_LAYER_MAP: Record<string, LayerID> = {
  hardscape: "hardscape.paving",
  structure: "hardscape.paving",
  irrigation: "civil.irrigation_main",
  softscape_beds: "softscape.planting",
  other: "draft.user_draft",
};

const DEFAULT_FEATURE_LAYER: LayerID = "draft.user_draft";

export function featureLayerIdFor(metadataLayer: string): LayerID {
  return FEATURE_LAYER_MAP[metadataLayer] ?? DEFAULT_FEATURE_LAYER;
}

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
  // Style + y-bias resolve from the Domain Layer Registry via the feature's
  // classified layer id — no per-component hex or ad-hoc lift.
  const layerId = featureLayerIdFor(feature.metadata.layer);
  const style = getLayerStyle(layerId);
  // Plane lift: a feature stamped `plane_z_m` (Tidy Z-plane routing) sits at
  // its depth-rail elevation. It does NOT drape onto terrain — it is off the
  // ground by definition — and it is not a pad (that is extrude_height_m).
  const planeLift = feature.plane_z_m ?? 0;
  const baseY = layerYOffset(layerId) + planeLift;
  const basePoints = useMemo(() => {
    const pts = feature.geometry.points.map((v) => {
      const [x, z] = pctToWorld(
        { x: v.pct.x_pct, y: v.pct.y_pct },
        scaleM,
        boardAspect,
      );
      return [x, baseY, z] as [number, number, number];
    });
    if (closed && pts.length >= 3) pts.push([...pts[0]!]);
    return pts;
  }, [feature.geometry, scaleM, boardAspect, closed, baseY]);

  const lineRef = useRef<ElementRef<typeof Line>>(null);
  const overlayRef = useRef<ElementRef<typeof Line>>(null);
  const scratch = useMemo(
    () => new Float32Array(Math.max(basePoints.length, 2) * 3),
    [basePoints.length],
  );

  useFrame(() => {
    // cadLinework scale-band visibility — the CAD read survives macro zoom
    // (band [0.2, 8] × fit) and cross-fades instead of popping. drei <Line>
    // materials default opaque; flip transparent so opacity takes effect.
    const alpha = layerScaleAlpha(
      "cadLinework",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    if (lineRef.current) {
      const m = lineRef.current.material;
      m.transparent = true;
      m.opacity = style.opacity * alpha;
    }
    if (overlayRef.current) {
      const m = overlayRef.current.material;
      m.transparent = true;
      m.opacity = alpha;
    }
    if (basePoints.length < 2) return;
    const { viewBlend } = useStudioStore.getState();
    // Elevated (plane-z) geometry never drapes — it holds its plane.
    if (!sampler || viewBlend < 0.001 || planeLift > 0) return;
    for (let i = 0; i < basePoints.length; i++) {
      const [x, , z] = basePoints[i]!;
      const y = baseY + viewBlend * sampler(x, z);
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

  return (
    <group>
      <Line
        ref={lineRef}
        points={basePoints}
        color={style.color}
        lineWidth={style.lineWidthPx}
        opacity={style.opacity}
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

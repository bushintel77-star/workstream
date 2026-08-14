"use client";

/**
 * Gold Standard 2026 — Asset Place Layer (click-to-place capture).
 *
 * The in-canvas half of the Asset Discovery Fan-Out: while a symbol is
 * armed, an invisible raycast plane owns pointer-down (the MeasureTapeLayer
 * pattern), snaps the click to the half-metre CAD grid, and mints a
 * CatalogPlacement in the store — the item renders immediately (items are
 * derived from store placements) and persists via the autosave PUT that
 * already fingerprints placements.
 *
 * Self-gating: returns null when nothing is armed. StudioControls yields
 * the gesture while a symbol is armed (see its onPointerDown guard).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "./studioStore";
import { worldToPct } from "./coordTransform";
import { snapToGridMetres } from "../handoff/geometry/snap";

export interface AssetPlaceLayerProps {
  scaleM: number;
  boardAspect: number;
}

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

export function AssetPlaceLayer({ scaleM, boardAspect }: AssetPlaceLayerProps) {
  const addPlacement = useStudioStore((s) => s.addPlacement);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);

  // One placement per arm — guards the stale-closure window between the
  // store update (disarm) and the next render. Reset when a NEW arm happens.
  const placedRef = useRef(false);
  useEffect(() => {
    if (armedSymbolId) placedRef.current = false;
  }, [armedSymbolId]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!armedSymbolId || placedRef.current || !e.point) return;
    e.stopPropagation();
    placedRef.current = true;

    // Snap to the half-metre CAD grid (board-% via the shared snap math).
    const raw = worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
    const snapped = snapToGridMetres(raw, scaleM);

    addPlacement({
      id: crypto.randomUUID(),
      symbol_id: armedSymbolId,
      x_pct: clampPct(snapped.x),
      y_pct: clampPct(snapped.y),
      rotation_deg: 0,
      scale: 1,
    });
    // Disarm after one placement (the dock stays open for repeat picks).
    setArmedSymbolId(null);
  };

  if (!armedSymbolId) return null;

  const planeSize = scaleM * 5;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerDown={onPointerDown}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

"use client";

/**
 * Gold Standard 2026 — Asset Place Layer (click-to-place + drop + mass plant).
 *
 * While a symbol is armed, an invisible raycast plane owns pointer-down,
 * snaps to the half-metre CAD grid, and mints a CatalogPlacement. HTML5
 * drops from the asset dock arrive as pendingAssetDrop (client coords →
 * ground ray).
 *
 * Two mass-plant gestures share the drag, mutually exclusive in the store:
 *   - Area: a box fill at mature spacing (groundcover / bed).
 *   - Row:  an evenly spaced run between two points — the hedge / border /
 *           edge case. Spacing defaults to the catalog spread, and oriented
 *           symbols take the run bearing so a hedge lies along the line.
 * Either way the whole drag is ONE undo commit (addPlacements), and the
 * flora ring stays out of it — mass planting is an explicit instruction, not
 * a moment for a ranked suggestion.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CatalogPlacement } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { worldToPct, type PctPoint } from "./coordTransform";
import { snapToGridMetres } from "../handoff/geometry/snap";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { symbolToFloraForm } from "./floraWorld";
import {
  gridInBox,
  massPlantSpacingM,
  rowAlongLine,
  rowRotationDeg,
} from "./fillAreaAssets";

export interface AssetPlaceLayerProps {
  scaleM: number;
  boardAspect: number;
}

/** Types whose 3D body has a length axis — a run bearing means something. */
const ORIENTED_TYPES = new Set(["hedge", "paving", "deck", "frenchdrain"]);

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

function clientToGroundPct(
  clientX: number,
  clientY: number,
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scaleM: number,
  boardAspect: number,
): PctPoint | null {
  const rect = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return worldToPct(hit.x, hit.z, scaleM, boardAspect);
}

function snapPct(raw: PctPoint, scaleM: number): PctPoint {
  const snapped = snapToGridMetres(raw, scaleM);
  return { x: clampPct(snapped.x), y: clampPct(snapped.y) };
}

function mintPlacement(
  symbolId: string,
  pct: PctPoint,
  rotationDeg = 0,
): CatalogPlacement {
  return {
    id: crypto.randomUUID(),
    symbol_id: symbolId,
    x_pct: pct.x,
    y_pct: pct.y,
    rotation_deg: rotationDeg,
    scale: 1,
  };
}

export function AssetPlaceLayer({ scaleM, boardAspect }: AssetPlaceLayerProps) {
  const addPlacement = useStudioStore((s) => s.addPlacement);
  const addPlacements = useStudioStore((s) => s.addPlacements);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const setFloraSession = useStudioStore((s) => s.setFloraSession);
  const pendingDrop = useStudioStore((s) => s.pendingAssetDrop);
  const setPendingDrop = useStudioStore((s) => s.setPendingAssetDrop);
  const areaPlantActive = useStudioStore((s) => s.areaPlantActive);
  const setAreaPlantActive = useStudioStore((s) => s.setAreaPlantActive);
  const rowPlantActive = useStudioStore((s) => s.rowPlantActive);
  const setRowPlantActive = useStudioStore((s) => s.setRowPlantActive);
  const setAssetPlantDraft = useStudioStore((s) => s.setAssetPlantDraft);
  const { camera, gl } = useThree();

  const placedRef = useRef(false);
  const dragStart = useRef<PctPoint | null>(null);
  const massMode: "row" | "area" | null = rowPlantActive
    ? "row"
    : areaPlantActive
      ? "area"
      : null;

  useEffect(() => {
    if (armedSymbolId) placedRef.current = false;
  }, [armedSymbolId]);

  useEffect(() => {
    if (!pendingDrop) return;
    const raw = clientToGroundPct(
      pendingDrop.clientX,
      pendingDrop.clientY,
      gl,
      camera,
      scaleM,
      boardAspect,
    );
    const symbolId = pendingDrop.symbolId;
    setPendingDrop(null);
    if (!raw || !symbolId) return;
    const pct = snapPct(raw, scaleM);
    const form = symbolToFloraForm(symbolId);
    if (form) {
      setFloraSession({ x: pct.x, y: pct.y, form });
      setArmedSymbolId(symbolId);
      return;
    }
    addPlacement(mintPlacement(symbolId, pct));
    setArmedSymbolId(null);
  }, [
    pendingDrop,
    gl,
    camera,
    scaleM,
    boardAspect,
    addPlacement,
    setPendingDrop,
    setFloraSession,
    setArmedSymbolId,
  ]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!armedSymbolId || !e.point) return;
    e.stopPropagation();
    const raw = worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
    const pct = snapPct(raw, scaleM);

    if (massMode) {
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
      dragStart.current = pct;
      setAssetPlantDraft({ mode: massMode, a: pct, b: pct });
      return;
    }

    if (placedRef.current) return;
    const form = symbolToFloraForm(armedSymbolId);
    if (form) {
      setFloraSession({ x: pct.x, y: pct.y, form });
      return;
    }
    placedRef.current = true;
    addPlacement(mintPlacement(armedSymbolId, pct));
    setArmedSymbolId(null);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!massMode || !dragStart.current || !e.point) return;
    e.stopPropagation();
    const pct = snapPct(worldToPct(e.point.x, e.point.z, scaleM, boardAspect), scaleM);
    setAssetPlantDraft({ mode: massMode, a: dragStart.current, b: pct });
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!armedSymbolId || !massMode || !start || !e.point) {
      setAssetPlantDraft(null);
      return;
    }
    e.stopPropagation();
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    const end = snapPct(worldToPct(e.point.x, e.point.z, scaleM, boardAspect), scaleM);
    const spacing = massPlantSpacingM(armedSymbolId);
    const points =
      massMode === "row"
        ? rowAlongLine(start, end, spacing, scaleM, boardAspect)
        : gridInBox(start, end, spacing, scaleM, boardAspect);
    const rotationDeg =
      massMode === "row" &&
      ORIENTED_TYPES.has(mapSymbolToStudioType(armedSymbolId))
        ? rowRotationDeg(start, end, scaleM, boardAspect)
        : 0;
    setAssetPlantDraft(null);
    addPlacements(points.map((p) => mintPlacement(armedSymbolId, p, rotationDeg)));
    setArmedSymbolId(null);
    setAreaPlantActive(false);
    setRowPlantActive(false);
  };

  if (!armedSymbolId && !pendingDrop) return null;

  const planeSize = scaleM * 5;

  return (
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
  );
}

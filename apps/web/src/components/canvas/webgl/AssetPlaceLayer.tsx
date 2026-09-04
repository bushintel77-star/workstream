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

import { useEffect, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { clampBoardPct } from "@workstream/contracts";
import type { CatalogPlacement } from "@workstream/contracts";
import { PALETTE, SEMANTIC } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { worldToPct, pctToWorld, type PctPoint } from "./coordTransform";
import { snapToGridMetres } from "../handoff/geometry/snap";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { symbolToFloraForm } from "./floraWorld";
import {
  gridInBox,
  massPlantSpacingM,
  matureCanopyRadiusM,
  rowAlongLine,
  rowRotationDeg,
} from "./fillAreaAssets";

export interface AssetPlaceLayerProps {
  scaleM: number;
  boardAspect: number;
}

/** Types whose 3D body has a length axis — a run bearing means something. */
const ORIENTED_TYPES = new Set(["hedge", "paving", "deck", "frenchdrain"]);

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
  return { x: clampBoardPct(snapped.x), y: clampBoardPct(snapped.y) };
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
  const setMassPlantPreviewCount = useStudioStore((s) => s.setMassPlantPreviewCount);
  const { camera, gl } = useThree();

  const placedRef = useRef(false);
  const dragStart = useRef<PctPoint | null>(null);
  // Live ghost preview position (snapped pct) — component-local, so the
  // pointer-move path never writes the zustand store per event.
  const [ghostPct, setGhostPct] = useState<PctPoint | null>(null);
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
    const ne = e.nativeEvent as PointerEvent;
    if (ne.clientX != null && ne.clientY != null) {
      setPointerClientPos({ x: ne.clientX, y: ne.clientY });
    }
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

  const setPointerClientPos = useStudioStore((s) => s.setPointerClientPos);

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!e.point) return;
    // Single-place armed: track the snapped position for the live ghost so
    // the operator sees the footprint under the cursor before committing.
    if (armedSymbolId && !massMode) {
      const pct = snapPct(worldToPct(e.point.x, e.point.z, scaleM, boardAspect), scaleM);
      setGhostPct(pct);
      return;
    }
    if (!massMode || !dragStart.current) return;
    e.stopPropagation();
    const pct = snapPct(worldToPct(e.point.x, e.point.z, scaleM, boardAspect), scaleM);
    setAssetPlantDraft({ mode: massMode, a: dragStart.current, b: pct });
    // Live stem count for cost preview in the dock.
    if (armedSymbolId) {
      const spacing = massPlantSpacingM(armedSymbolId);
      const pts = massMode === "row"
        ? rowAlongLine(dragStart.current, pct, spacing, scaleM, boardAspect)
        : gridInBox(dragStart.current, pct, spacing, scaleM, boardAspect);
      setMassPlantPreviewCount(pts.length);
    }
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current;
    dragStart.current = null;
    setGhostPct(null);
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
    setMassPlantPreviewCount(0);
    addPlacements(points.map((p) => mintPlacement(armedSymbolId, p, rotationDeg)));
    setArmedSymbolId(null);
    setAreaPlantActive(false);
    setRowPlantActive(false);
  };

  if (!armedSymbolId && !pendingDrop) return null;

  const planeSize = scaleM * 5;
  // Ghost footprint preview — a snapped ring + disc under the cursor while
  // armed (single-place). Sized from the catalog's mature spread; crimson
  // when it would sit too close to an existing placement (conflict = the
  // flora-ring language, so a hardscape ghost reads the same way).
  let ghost = null;
  if (armedSymbolId && ghostPct && !massMode) {
    const radiusM = matureCanopyRadiusM(armedSymbolId) ?? 0.6;
    const [gwx, gwz] = pctToWorld(ghostPct, scaleM, boardAspect);
    const placements = useStudioStore.getState().placements;
    const conflict = placements.some((p) => {
      const [px, pz] = pctToWorld(
        { x: p.x_pct, y: p.y_pct },
        scaleM,
        boardAspect,
      );
      const otherR = matureCanopyRadiusM(p.symbol_id) ?? 0.6;
      return Math.hypot(px - gwx, pz - gwz) < radiusM + otherR + 0.4;
    });
    // Truth Anchor cobalt — the data-stroke colour on paper (8.22:1 on
    // #F4F4F4), so the ghost reads on the drafting sheet; crimson on conflict
    // (same vocabulary as the flora ring).
    const ghostColor = conflict ? PALETTE.gsConflict : SEMANTIC.proposedStroke;
    // Centre crosshair is a fixed WORLD size — always legible regardless of
    // footprint (a 0.6 m paver ring would vanish at fit zoom otherwise).
    const cross = Math.max(0.5, radiusM * 0.18);
    ghost = (
      <group>
        {/* Crosshair — the exact snapped placement point */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gwx, 0.075, gwz]}>
          <planeGeometry args={[cross * 2.4, 0.09]} />
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gwx, 0.075, gwz]}>
          <planeGeometry args={[0.09, cross * 2.4]} />
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Footprint ring — honest mature-spread radius (crimson on conflict) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gwx, 0.06, gwz]}>
          <ringGeometry args={[Math.max(0.15, radiusM - 0.12), Math.max(0.2, radiusM), 32]} />
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gwx, 0.05, gwz]}>
          <circleGeometry args={[Math.max(0.2, radiusM), 32]} />
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <>
      {ghost}
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
    </>
  );
}

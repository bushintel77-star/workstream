"use client";

/**
 * Gold Standard 2026 — Asset Place Layer (click-to-place + drop + area fill).
 *
 * While a symbol is armed, an invisible raycast plane owns pointer-down,
 * snaps to the half-metre CAD grid, and mints a CatalogPlacement. HTML5
 * drops from the asset dock arrive as pendingAssetDrop (client coords →
 * ground ray). Area-plant mode drag-fills a box at mature spacing.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { getCatalogSymbol } from "@workstream/domain";
import type { CatalogPlacement } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { worldToPct, type PctPoint } from "./coordTransform";
import { snapToGridMetres } from "../handoff/geometry/snap";
import { symbolToFloraForm } from "./floraWorld";
import { gridInBox } from "./fillAreaAssets";

export interface AssetPlaceLayerProps {
  scaleM: number;
  boardAspect: number;
}

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

function mintPlacement(symbolId: string, pct: PctPoint): CatalogPlacement {
  return {
    id: crypto.randomUUID(),
    symbol_id: symbolId,
    x_pct: pct.x,
    y_pct: pct.y,
    rotation_deg: 0,
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
  const { camera, gl } = useThree();

  const placedRef = useRef(false);
  const boxStart = useRef<PctPoint | null>(null);

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

    if (areaPlantActive) {
      boxStart.current = pct;
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

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!armedSymbolId || !areaPlantActive || !boxStart.current || !e.point) {
      boxStart.current = null;
      return;
    }
    e.stopPropagation();
    const raw = worldToPct(e.point.x, e.point.z, scaleM, boardAspect);
    const end = snapPct(raw, scaleM);
    const catalog = getCatalogSymbol(armedSymbolId);
    const spacing = catalog?.default_width_m ?? catalog?.mature_height_m ?? 1.5;
    const pts = gridInBox(boxStart.current, end, spacing, scaleM, boardAspect);
    boxStart.current = null;
    const form = symbolToFloraForm(armedSymbolId);
    if (form) {
      const first = pts[0];
      if (first) setFloraSession({ x: first.x, y: first.y, form });
      return;
    }
    addPlacements(pts.map((p) => mintPlacement(armedSymbolId, p)));
    setArmedSymbolId(null);
    setAreaPlantActive(false);
  };

  if (!armedSymbolId && !pendingDrop) return null;

  const planeSize = scaleM * 5;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

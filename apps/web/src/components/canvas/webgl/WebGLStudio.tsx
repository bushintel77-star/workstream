"use client";

/**
 * Gold Standard 2026 — WebGL primary surface.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md
 *
 * The R3F replacement for the SVG viewBox "0 0 100 100" board. Renders the
 * drawing as Three.js geometry in metre-space (1 unit = 1 metre, origin at
 * the (0,0,0) Signal Blue survey peg).
 *
 *   Layer 1: Canvas base (#101418 clear color)
 *   Layer 2: R3F <Canvas> — geometry, subsurface, trees, boundaries
 *   Layer 3: DOM chrome overlay — Glass Cards (sibling div, pointer-events:none)
 */

import { Canvas } from "@react-three/fiber";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { WebGLRenderer } from "three";
import { StudioScene } from "./StudioScene";
import type { StudioCameraRig } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";
import type { SubsurfaceUtility, StrikeAlertData } from "./features/SubsurfaceEngine";
import type { PresentationLensFilter } from "./PresentationLens";

export interface WebGLStudioProps {
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  servicesPct?: PctPoint[][];
  items?: RenderItem[];
  buildingOpacity?: number;
  cameraRig: StudioCameraRig;
  onRigChange?: (rig: StudioCameraRig) => void;
  onGroundClick?: (pct: PctPoint) => void;
  onCursorMove?: (pct: PctPoint | null) => void;
  subsurfaceUtilities?: SubsurfaceUtility[];
  strikeAlerts?: StrikeAlertData[];
  lens?: PresentationLensFilter;
  children?: ReactNode;
  style?: CSSProperties;
}

export function WebGLStudio({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  servicesPct,
  items,
  buildingOpacity,
  cameraRig,
  onRigChange,
  onGroundClick,
  onCursorMove,
  subsurfaceUtilities,
  strikeAlerts,
  lens,
  children,
  style,
}: WebGLStudioProps) {
  const onCanvasCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    gl.setClearColor("#101418");
  }, []);

  return (
    <div
      data-testid="webgl-studio"
      style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 100, 0.001], zoom: 8, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={onCanvasCreated}
        style={{ position: "absolute", inset: 0 }}
        data-testid="webgl-canvas"
      >
        <StudioScene
          scaleM={scaleM}
          boardAspect={boardAspect}
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          easementsPct={easementsPct}
          servicesPct={servicesPct}
          items={items}
          buildingOpacity={buildingOpacity}
          cameraRig={cameraRig}
          onRigChange={onRigChange}
          onGroundClick={onGroundClick}
          onCursorMove={onCursorMove}
          subsurfaceUtilities={subsurfaceUtilities}
          strikeAlerts={strikeAlerts}
          lens={lens}
        />
      </Canvas>

      <div
        data-testid="webgl-chrome-overlay"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {children}
      </div>
    </div>
  );
}

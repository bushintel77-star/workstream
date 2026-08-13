"use client";

/**
 * Gold Standard 2026 — WebGL primary surface.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md
 *
 * This is the R3F replacement for the SVG viewBox "0 0 100 100" board in
 * HandoffDesignStudio. It renders the drawing as Three.js geometry in
 * metre-space (1 unit = 1 metre, origin at the (0,0,0) Signal Blue survey peg).
 *
 * Architecture (ARCHITECTURE.md §1–3):
 *   Layer 1: Canvas base (#101418 clear color)
 *   Layer 2: R3F <Canvas> — all geometry, subsurface, trees, boundaries
 *   Layer 3: DOM chrome overlay — Glass Cards (sibling div, pointer-events:none)
 *
 * The DOM overlay is a sibling <div> above the <Canvas>. Individual Glass Cards
 * set pointer-events:auto. This satisfies the gate-C principle: no chrome lives
 * inside the WebGL camera transform.
 *
 * SSR boundary: this component is dynamically imported with ssr:false by the
 * project page — WebGL requires the browser. The "use client" directive is
 * kept for clarity but the real guard is the dynamic import at the call site.
 */

import { Canvas } from "@react-three/fiber";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import type { WebGLRenderer } from "three";
import { StudioScene } from "./StudioScene";
import type { StudioCameraRig } from "./cameraRig";

export interface WebGLStudioProps {
  /** Width of the lot in metres (the fitted boardWidthM). */
  scaleM: number;
  /** Aspect ratio of the board (height / width). */
  boardAspect: number;
  /** Lot boundary polygon in % space (0–100). Ported from CadPlanBoard. */
  boundaryPct: Array<{ x: number; y: number }>;
  /** Building footprint polygon in % space, if any. */
  buildingPct?: Array<{ x: number; y: number }>;
  /** Camera rig state (pan, zoom, tilt, rotation). */
  cameraRig: StudioCameraRig;
  /** Children render into the DOM chrome overlay (Layer 3). */
  children?: ReactNode;
  /** Container style override. */
  style?: CSSProperties;
}

/**
 * The full-bleed WebGL studio. Mounts the R3F Canvas at inset:0 and a DOM
 * overlay div for Glass Card chrome.
 */
export function WebGLStudio({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  cameraRig,
  children,
  style,
}: WebGLStudioProps) {
  const onCanvasCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    // Clear color = --gs-canvas (#101418) per Gold Standard §2
    gl.setClearColor("#101418");
  }, []);

  return (
    <div
      data-testid="webgl-studio"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {/*
       * Layer 2: the WebGL canvas.
       * Orthographic camera for the default top-down CAD view; the rig
       * (StudioScene) handles tilt by transitioning the camera position.
       */}
      <Canvas
        orthographic
        camera={{
          position: [0, 100, 0.001],
          zoom: 8,
          near: 0.1,
          far: 10000,
        }}
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
          cameraRig={cameraRig}
        />
      </Canvas>

      {/*
       * Layer 3: DOM chrome overlay.
       * Sibling of the Canvas, positioned above it. Glass Cards render here.
       * pointer-events:none on the container so the Canvas receives pointer
       * events for drawing/selection; individual cards opt back in.
       */}
      <div
        data-testid="webgl-chrome-overlay"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

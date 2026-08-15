"use client";

/**
 * Gold Standard 2026 — WebGL primary surface (best-possible-quality render).
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md
 *
 * The R3F replacement for the SVG viewBox "0 0 100 100" board. Renders the
 * drawing as Three.js geometry in metre-space (1 unit = 1 metre, origin at
 * the (0,0,0) Signal Blue survey peg).
 *
 *   Layer 1: Canvas base (#101418 clear color + matching fog)
 *   Layer 2: R3F <Canvas> — geometry, subsurface, trees, boundaries, IBL
 *   Layer 3: DOM chrome overlay — Glass Cards (sibling div, pointer-events:none)
 *
 * Render quality stack (exceeds the GrowthStudio reference):
 *   - ACES Filmic tone mapping + sRGB output
 *   - VSM shadow maps (soft shadows, no r185 PCFSoft deprecation)
 *   - Image-based lighting via drei <Environment> (background=false keeps #101418)
 *   - Post-processing: Bloom (emissive glow) + N8AO (ambient occlusion) +
 *     Vignette (focus) + SMAA (edge AA)
 *   - Linear fog matching the canvas colour for depth
 */

import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  N8AO,
  Vignette,
  SMAA,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";
import type { WebGLRenderer } from "three";
import { PALETTE } from "../../../styles/colorTokens";
import { StudioScene } from "./StudioScene";
import type { StudioCameraRig } from "./cameraRig";
import type { PctPoint, HeightmapPoint } from "./coordTransform";
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
  /** Pin the camera blend (split view's locked half). See FusedCamera. */
  viewBlendLocked?: number;
  onRigChange?: (rig: StudioCameraRig) => void;
  onGroundClick?: (pct: PctPoint) => void;
  onCursorMove?: (pct: PctPoint | null) => void;
  subsurfaceUtilities?: SubsurfaceUtility[];
  strikeAlerts?: StrikeAlertData[];
  lens?: PresentationLensFilter;
  /** Growth factor 0–1 (0 = just planted, 1 = 10-year maturity). */
  growthFactor?: number;
  /** Project latitude for real-sun lighting (decimal degrees). */
  lat?: number;
  /** Project longitude for real-sun lighting (decimal degrees). */
  lng?: number;
  /** Minutes past Melbourne midnight — time-of-day for the sun sample. */
  sunMin?: number;
  /** Aerial photo URI — rendered as a ground underlay texture (fades in 3D). */
  aerialUri?: string | null;
  /** Spot level sample points for the terrain heightmap (world space). */
  heightmapPoints?: HeightmapPoint[];
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Post-processing stack — tuned conservative for the dark Studio aesthetic.
 * Bloom only catches bright/emissive surfaces (gold HUD, strike alerts,
 * subsurface tubes, window glow); N8AO adds real occlusion in foliage/building
 * crevices; Vignette + SMAA finish the cinematic frame.
 */
function RenderFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <N8AO
        aoRadius={6}
        intensity={1.4}
        distanceFalloff={0.8}
        quality="medium"
        color="black"
      />
      <Bloom
        intensity={0.55}
        luminanceThreshold={0.65}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.7}
        kernelSize={KernelSize.LARGE}
      />
      <Vignette
        offset={0.32}
        darkness={0.45}
        blendFunction={BlendFunction.NORMAL}
      />
      <SMAA />
    </EffectComposer>
  );
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
  viewBlendLocked,
  onRigChange,
  onGroundClick,
  onCursorMove,
  subsurfaceUtilities,
  strikeAlerts,
  lens,
  growthFactor,
  lat,
  lng,
  sunMin,
  aerialUri,
  heightmapPoints,
  children,
  style,
}: WebGLStudioProps) {
  const onCanvasCreated = useCallback(({ gl, scene }: { gl: WebGLRenderer; scene: THREE.Scene }) => {
    gl.setClearColor(PALETTE.gsCanvas);
    // ACES Filmic tone mapping — rolls off highlights smoothly instead of the
    // harsh linear clip (NoToneMapping) that makes the default render read as
    // flat/plastic. The single biggest "design render vs CG" lever.
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    /* ACES filmic compresses mid-tones hard — a daylight garden scene needs
     * ~1.4 to read sunlit rather than dusk (calibrated on the Wrights Terrace
     * demo for foliage legibility while keeping shadow shape). */
    gl.toneMappingExposure = 1.4;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    // Linear fog matching the canvas colour — fades distant geometry into the
    // void for depth, hides the ground-plane edge cliff. Same technique the
    // GrowthStudio reference uses.
    scene.fog = new THREE.Fog(PALETTE.gsCanvas, scaleM * 1.5, scaleM * 3.6);
  }, [scaleM]);

  return (
    <div
      data-testid="webgl-studio"
      style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
    >
      <Canvas
        shadows="variance"
        camera={{ position: [0, 100, 0.001], fov: 30, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={onCanvasCreated}
        style={{ position: "absolute", inset: 0 }}
        data-testid="webgl-canvas"
      >
        {/*
         * Image-based lighting — a soft outdoor environment contributes real
         * sky/bounce reflections to every PBR material. background={false} is
         * critical: the IBL lights the scene but the canvas keeps clearing to
         * #101418 (doc §1.1 binding).
         */}
        <Environment preset="park" background={false} environmentIntensity={0.35} />

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
          viewBlendLocked={viewBlendLocked}
          onRigChange={onRigChange}
          onGroundClick={onGroundClick}
          onCursorMove={onCursorMove}
          subsurfaceUtilities={subsurfaceUtilities}
          strikeAlerts={strikeAlerts}
          lens={lens}
          growthFactor={growthFactor}
          lat={lat}
          lng={lng}
          sunMin={sunMin}
          aerialUri={aerialUri}
          heightmapPoints={heightmapPoints}
        />

        <RenderFX />
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

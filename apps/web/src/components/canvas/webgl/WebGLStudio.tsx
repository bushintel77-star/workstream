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
 *   Layer 1: Canvas base (Studio Paper #F4F4F4 clear color + matching fog)
 *   Layer 2: R3F <Canvas> — geometry, subsurface, trees, boundaries, IBL
 *   Layer 3: DOM chrome overlay — white panels (sibling div, pointer-events:none)
 *
 * Render quality stack (exceeds the GrowthStudio reference):
 *   - ACES Filmic tone mapping + sRGB output
 *   - VSM shadow maps (soft shadows, no r185 PCFSoft deprecation)
 *   - Image-based lighting via drei <Environment> (background=false keeps the paper clear)
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
  DepthOfField,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WebGLRenderer } from "three";
import type {
  CatalogPlacement,
  ConstructionTrench,
  DesignKeylessOverlay,
  DesignNeighbourBuilding,
  DesignSiteFrameLevel,
  IrrigationZone,
  LandscapeFeature,
} from "@workstream/contracts";
import { canvasLayerPolicy } from "./layerPolicy";
import { parseCanvasMode } from "../../../lib/canvas-mode";
import { ChromeRecedeWatcher } from "./ChromeRecedeWatcher";
import { StudioScene } from "./StudioScene";
import type { PctPoint, HeightmapPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";
import type { SubsurfaceUtility, StrikeAlertData } from "./features/SubsurfaceEngine";
import type { PresentationLensFilter } from "./PresentationLens";
import type { AnnotationDialect } from "./annotations/model";
import { useStudioStore, type SurveyedPlanLayers } from "./studioStore";

/**
 * Image-based lighting must never take the drawing down: a failed
 * environment load (network hiccup, rate limit, missing asset) renders
 * nothing here and the scene falls back to its direct lights instead of
 * tripping the route error boundary.
 */
class StudioEnvironmentBoundary extends Component<
  { children?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[webgl] environment lighting unavailable", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface WebGLStudioProps {
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  servicesPct?: PctPoint[][];
  items?: RenderItem[];
  buildingOpacity?: number;
  /** Pin the camera blend (split view's locked half). See FusedCamera. */
  viewBlendLocked?: number;
  onGroundClick?: (pct: PctPoint, opts: { additive: boolean }) => void;
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
  /** Spot level sample points for the terrain heightmap (world space). */
  heightmapPoints?: HeightmapPoint[];
  keylessOverlays?: DesignKeylessOverlay[];
  neighbourBuildings?: DesignNeighbourBuilding[];
  showSketch?: boolean;
  onContextLost?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
  /** Active canvas mode — drives the meta chip-set's phase illumination. */
  mode?: string;
  /** Cadastral/environmental records for the ambient meta chip-set. */
  siteMeta?: {
    titleRef?: string | null;
    lga?: string | null;
    lotAreaM2?: number | null;
    sunHours?: number | null;
  };
  northBearingDeg?: number | null;
  levels?: DesignSiteFrameLevel[];
  placements?: CatalogPlacement[];
  features?: LandscapeFeature[];
  annotationDialect?: AnnotationDialect;
  annotationLayers?: SurveyedPlanLayers;
  tradePacks?: {
    irrigationDrainage: boolean;
    hardscapeConstruction: boolean;
    lightingElectrical: boolean;
  };
  constructionTrenches?: ConstructionTrench[];
  irrigationZones?: IrrigationZone[];
}

/**
 * Post-processing stack — tuned conservative for the Studio Paper canvas.
 * Bloom only catches bright/emissive surfaces (gold HUD, strike alerts,
 * subsurface tubes, window glow); N8AO adds real occlusion in foliage/building
 * crevices; Vignette + SMAA finish the cinematic frame.
 *
 * Phase 8: IMMERSIVE mode adds DepthOfField with dynamic autofocus — a
 * raycaster from the screen center drives the focus distance every frame,
 * smoothly damped to avoid jitter. N8AO intensity + quality are also boosted.
 */
function RenderFX({ drafting }: { drafting: boolean }) {
  const renderMode = useStudioStore((s) => s.renderMode);
  const immersive = renderMode === "IMMERSIVE";

  /* Paper modes: skip the EffectComposer entirely so the canvas renders
     as clean #F4F4F4 paper. The N8AO screen-space algorithm darkens flat
     surfaces (it treats the ground mesh as self-occluding), and the
     Vignette/Bloom add further atmospheric darkening — all undesirable on
     a drafting sheet. Site/3D modes keep the full cinematic stack. */
  if (drafting) {
    return (
      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <N8AO
        aoRadius={4}
        intensity={immersive ? 1.6 : 1.15}
        distanceFalloff={0.8}
        quality={immersive ? "high" : "medium"}
        color="black"
      />
      {immersive && <DynamicDoF />}
      <Bloom
        intensity={0.25}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.7}
        kernelSize={KernelSize.LARGE}
      />
      <Vignette
        offset={0.4}
        darkness={immersive ? 0.2 : 0.12}
        blendFunction={BlendFunction.NORMAL}
      />
      <SMAA />
    </EffectComposer>
  );
}

/**
 * Dynamic Depth of Field — fires a raycaster from the screen center (NDC 0,0)
 * every frame, measures the distance to the first hit, and smoothly damps the
 * DoF focusDistance to match. Creates a cinematic autofocus effect that draws
 * the eye to whatever the camera is looking at.
 */
function DynamicDoF() {
  const { camera, scene, raycaster } = useThree();
  const dofRef = useRef<{ focusDistance: number; focusRange: number } | null>(
    null,
  );
  const currentFocus = useRef(10);
  const targetFocus = useRef(10);
  const tempNdc = useRef(new THREE.Vector2(0, 0));

  useFrame((_, delta) => {
    // Raycast from the screen center (NDC 0,0) straight forward.
    raycaster.setFromCamera(tempNdc.current, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    if (hits.length > 0 && hits[0]) {
      targetFocus.current = hits[0].distance;
    }

    // Smoothly damp toward the target focus distance (avoid jitter).
    const dampFactor = 1 - Math.exp(-delta * 4);
    currentFocus.current = THREE.MathUtils.lerp(
      currentFocus.current,
      targetFocus.current,
      dampFactor,
    );

    // The DepthOfField effect's focusDistance is normalized 0–1 relative to
    // the camera's far plane. We use a pragmatic normalization: focus distance
    // in metres divided by a reference far distance of 100m.
    const normalized = Math.min(currentFocus.current / 100, 1);
    if (dofRef.current) {
      dofRef.current.focusDistance = normalized;
    }
  });

  return (
    <DepthOfField
      ref={(ref) => {
        dofRef.current = ref as unknown as {
          focusDistance: number;
          focusRange: number;
        } | null;
      }}
      focusDistance={0.1}
      focusRange={0.3}
      bokehScale={3}
      height={480}
    />
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
  viewBlendLocked,
  onGroundClick,
  onCursorMove,
  subsurfaceUtilities,
  strikeAlerts,
  lens,
  growthFactor,
  lat,
  lng,
  sunMin,
  heightmapPoints,
  keylessOverlays,
  neighbourBuildings,
  showSketch,
  onContextLost,
  children,
  style,
  mode = "survey",
  siteMeta,
  northBearingDeg,
  levels,
  placements,
  features,
  annotationDialect,
  annotationLayers,
  tradePacks,
  constructionTrenches,
  irrigationZones,
}: WebGLStudioProps) {
  // Drafting (paper) modes — survey/sketch/cad/elevation — render the ground
  // as a flat neutral sheet (the drawing is the product). They drop the warm
  // garden IBL + ACES exposure so #F4F4F4 stays paper; site/3D presentation
  // modes keep the sunny daylight look.
  const drafting =
    canvasLayerPolicy(parseCanvasMode(mode) ?? "survey").groundAlbedo === "paper";
  const canvasTheme = useStudioStore((s) => s.canvasTheme);
  // Refs for live theme updates without remounting the Canvas.
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Theme-aware clear color: DARK = deep charcoal void, LIGHT = vellum.
  const clearColor = canvasTheme === "DARK" ? "#0f1115" : "#f3f4f6";
  const onCanvasCreated = useCallback(({ gl, scene }: { gl: WebGLRenderer; scene: THREE.Scene }) => {
    glRef.current = gl;
    sceneRef.current = scene;
    gl.setClearColor(clearColor);
    // Drafting (paper) modes use NoToneMapping so the clear color stays
    // dead-neutral — ACES Filmic's S-curve shifts bright whites warm.
    // Site/3D modes keep ACES + exposure 1.55 for the sunny daylight look.
    gl.toneMapping = drafting ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = drafting ? 1.0 : 1.55;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    // Linear fog matching the canvas colour — fades distant geometry into the
    // void for depth, hides the ground-plane edge cliff.
    scene.fog = new THREE.Fog(clearColor, scaleM * 4, scaleM * 10);
    gl.domElement.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        // R3F forces a context loss during its own teardown (split-view swap,
        // navigation) — by then the canvas is already detached from the DOM.
        // Only a loss on a live canvas is fatal; a detached target is the
        // planned disposal of a surface we are leaving anyway.
        if (!gl.domElement.isConnected) return;
        onContextLost?.();
      },
      { once: true },
    );
  }, [onContextLost, scaleM, drafting, clearColor]);

  // Live theme toggle — update clear color + fog without remounting the Canvas.
  useEffect(() => {
    const gl = glRef.current;
    const scene = sceneRef.current;
    if (!gl || !scene) return;
    gl.setClearColor(clearColor);
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.set(clearColor);
    }
  }, [clearColor]);

  return (
    <div
      data-testid="webgl-studio"
      style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
    >
      <Canvas
        shadows="variance"
        dpr={[1, 1.5]}
        camera={{ position: [0, 100, 0.001], fov: 30, near: 0.1, far: 500 }}
        /* preserveDrawingBuffer: the PDF viewport capture (pdfExport.ts)
           reads the framebuffer with toDataURL after compositing — without
           this the buffer is cleared at present and captures come back
           blank racily. Cost is a held backbuffer; worth deterministic
           sheet export. */
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={onCanvasCreated}
        /* Force a full Canvas remount when drafting toggles so the
           EffectComposer tree is rebuilt from scratch (R3F reconciler
           does not hot-swap post-processing passes). */
        key={drafting ? "paper" : "3d"}
        style={{ position: "absolute", inset: 0 }}
        data-testid="webgl-canvas"
      >
        {/*
         * Image-based lighting — a soft outdoor environment contributes real
         * sky/bounce reflections to every PBR material. background={false} is
         * critical: the IBL lights the scene but the canvas keeps clearing to
         * Studio Paper #F4F4F4 (doc §1.1 binding).
         *
         * Vendored locally (public/hdri, CC0 from Poly Haven): the previous
         * preset fetched raw.githubusercontent.com at runtime, and a GitHub
         * 429 killed the whole canvas into the studio error boundary.
         * StudioEnvironmentBoundary degrades to direct lights if this ever
         * fails to load again.
         */}
        {/*
         * Drafting modes: environmentIntensity = 0 eliminates IBL warm bounce
         * so the #F4F4F4 paper canvas stays dead-neutral (the park HDRI's green
         * ground-bounce was shifting the perceived clear colour olive). Site/3D
         * modes keep 0.55 for the sunny daylight look.
         */}
        <StudioEnvironmentBoundary>
          <Environment
            files="/hdri/rooitou_park_1k.hdr"
            background={false}
            environmentIntensity={drafting ? 0 : 0.55}
          />
        </StudioEnvironmentBoundary>

        <StudioScene
          scaleM={scaleM}
          boardAspect={boardAspect}
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          easementsPct={easementsPct}
          servicesPct={servicesPct}
          items={items}
          buildingOpacity={buildingOpacity}
          viewBlendLocked={viewBlendLocked}
          onGroundClick={onGroundClick}
          onCursorMove={onCursorMove}
          subsurfaceUtilities={subsurfaceUtilities}
          strikeAlerts={strikeAlerts}
          lens={lens}
          growthFactor={growthFactor}
          lat={lat}
          lng={lng}
          sunMin={sunMin}
          heightmapPoints={heightmapPoints}
          keylessOverlays={keylessOverlays}
          neighbourBuildings={neighbourBuildings}
          showSketch={showSketch}
          mode={mode}
          siteMeta={siteMeta}
          northBearingDeg={northBearingDeg}
          levels={levels}
          placements={placements}
          features={features}
          annotationDialect={annotationDialect}
          annotationLayers={annotationLayers}
          tradePacks={tradePacks}
          constructionTrenches={constructionTrenches}
          irrigationZones={irrigationZones}
        />

        <RenderFX drafting={drafting} />
        {/* Camera-motion detector for the chrome recede — flips the store
            flag on state change only (never per-frame). */}
        <ChromeRecedeWatcher />
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

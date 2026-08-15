/**
 * Gold Standard 2026 — the 3D scene graph.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §2–3
 *
 * Renders inside the R3F <Canvas>. Contains:
 *   - Lighting (ambient + directional for sun)
 *   - Ground plane (--gs-canvas, adaptive grid)
 *   - Origin peg (Signal Blue crosshair at (0,0,0))
 *   - Lot boundary (Signal Blue line)
 *   - Easements (Signal Blue dashed lines)
 *   - Services (APWA-coloured lines)
 *   - Building footprint (extruded mesh)
 *   - Placed items (trees, regions, hardscape)
 *
 * Coordinate system: metre-space. % space (0–100) is converted via coordTransform.
 */

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { sunPositionAt } from "@workstream/domain";
import {
  createElevationSampler,
  drapeRingToSurface,
} from "./terrainMath";
import { buildTerrainGeometry } from "./TerrainMesh";
import { SPATIAL_LAYER } from "./layerContract";
import { sunDateFromPreset } from "../handoff/features/sunGrowth/sunDatePreset";
import { PALETTE } from "../../../styles/colorTokens";
import { useSeasonalStore, winterFactor } from "./seasonalStore";
import type { StudioCameraRig } from "./cameraRig";
import { pctToWorld, type PctPoint, type HeightmapPoint } from "./coordTransform";
import { SceneItems, type RenderItem } from "./sceneItems";
import { StudioControls } from "./StudioControls";
import { SubsurfaceEngine, type SubsurfaceUtility, type StrikeAlertData } from "./features/SubsurfaceEngine";
import { FusedCamera } from "./FusedCamera";
import { FusedSketchLayer } from "./FusedSketchLayer";
import { TerrainMesh } from "./TerrainMesh";
import { ElevationSliceLine } from "./ElevationSliceLine";
import { DrainageFlowLayer } from "./DrainageFlowLayer";
import { EarthworksLayer } from "./EarthworksLayer";
import { DimensionLayer } from "./DimensionLayer";
import { MeasureTapeLayer } from "./MeasureTapeLayer";
import { AssetPlaceLayer } from "./AssetPlaceLayer";
import { FloraRingLayer } from "./FloraRingLayer";
import { type PresentationLensFilter } from "./PresentationLens";

/** Prahran demo fallback — same default as the 2D sun/growth dock + GrowthStudio. */
const DEFAULT_SUN_LAT = -37.849;
const DEFAULT_SUN_LNG = 144.993;

/**
 * Resolve a real-world sun direction (from `sunPositionAt`) into a Three.js
 * directional-light position, reusing the proven GrowthStudioClient projection.
 *
 * Convention: +X = east, +Y = up, +Z = south (azimuth 0°/north → -Z).
 * Altitude is floored at 3° (lower than GrowthStudio's 6° noon clamp) so a
 * low morning/evening sun produces the long, dramatic ground shadows the
 * domain `boardShadowCast` also models — shadow length ∝ 1/tan(altitude).
 */
function resolveSunLightPosition(
  lat: number,
  lng: number,
  sunMin: number,
  sunDist: number,
): { position: [number, number, number]; altitudeDeg: number; azimuthDeg: number } {
  const when = sunDateFromPreset("today", sunMin);
  const sun = sunPositionAt(lat, lng, when);
  // Floor altitude at 3° — below this the sun is grazing and shadows stretch
  // toward infinity; clamp keeps them long-but-finite and visible on the board.
  const altRad = (Math.max(sun.altitude_deg, 3) * Math.PI) / 180;
  const azRad = (sun.azimuth_deg * Math.PI) / 180;
  return {
    position: [
      Math.cos(altRad) * Math.sin(azRad) * sunDist,
      Math.sin(altRad) * sunDist,
      -Math.cos(altRad) * Math.cos(azRad) * sunDist,
    ],
    altitudeDeg: sun.altitude_deg,
    azimuthDeg: sun.azimuth_deg,
  };
}

export interface StudioSceneProps {
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
  /** Subsurface utilities to render (Phase 2 Subsurface Engine). */
  subsurfaceUtilities?: SubsurfaceUtility[];
  /** Strike alerts to render (Phase 2 Strike Alert Engine). */
  strikeAlerts?: StrikeAlertData[];
  /** Presentation Lens filter — hides technical layers when active. */
  lens?: PresentationLensFilter;
  /** Growth factor 0–1 (0 = just planted, 1 = 10-year maturity). */
  growthFactor?: number;
  /** Project latitude (decimal degrees) for real-sun lighting. Falls back to Prahran demo. */
  lat?: number;
  /** Project longitude (decimal degrees) for real-sun lighting. Falls back to Prahran demo. */
  lng?: number;
  /** Minutes past Melbourne midnight — the time-of-day the sun is sampled at. */
  sunMin?: number;
  /** Aerial photo URI — rendered as a ground underlay texture (fades in 3D). */
  aerialUri?: string | null;
  /** Spot level sample points for the terrain heightmap (world space). */
  heightmapPoints?: HeightmapPoint[];
}

/** Signal Blue origin peg — a crosshair at (0,0,0). */
function OriginPeg({
  sampler,
}: {
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  // truth-soft — the origin crosshair must stay visible on the dark ground.
  const blue = "#6B8EEA";
  const arm = 1.2;
  // Survey furniture rides the terrain (the peg anchors real ground, not a
  // floating datum) at the marker-layer clearance.
  const y = (sampler ? sampler(0, 0) : 0) + SPATIAL_LAYER.markers.offsetM;
  return (
    <group position={[0, y, 0]} renderOrder={SPATIAL_LAYER.markers.renderOrder}>
      <mesh>
        <boxGeometry args={[arm * 2, 0.08, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.08, arm * 2, 0.01]} />
        <meshBasicMaterial color={blue} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color={blue} />
      </mesh>
    </group>
  );
}


/**
 * Real-sun lighting rig — warm sun key + cool sky bounce + soft fill.
 *
 * The key light's position and intensity are driven by the real solar position
 * (`sunPositionAt`) for the project lat/lng at a given minute of the day. A low
 * morning/evening sun casts long, soft ground shadows; high noon casts short,
 * crisp ones — the same physics the domain `boardShadowCast` models on the 2D
 * board. This is the Gold Standard UX sun/shadow system, surfaced in 3D.
 *
 * Light tints resolve to render tokens, not raw hex. Convention: +X east, +Y up,
 * +Z south (north = -Z), matching GrowthStudioClient.
 */
/**
 * Real-sun lighting rig — warm sun key + cool sky bounce + soft fill + rim.
 *
 * The key light's position + intensity are mutated every frame inside useFrame
 * (reading sunMin + seasonProgress via getState — zero React re-renders). The
 * seasonal elevation multiplier lowers the sun in winter → longer shadows that
 * interact heavily with the N8AO ambient occlusion (LA Seasonal Dynamics Rule 4).
 */
function SunRig({
  scaleM,
  boardAspect,
  lat,
  lng,
}: {
  scaleM: number;
  boardAspect: number;
  lat: number;
  lng: number;
}) {
  const sunDist = scaleM * 2.2;
  const half = Math.max(scaleM, scaleM * boardAspect) * 0.9;
  const keyRef = useRef<THREE.DirectionalLight>(null);

  // Mutation loop — reads the time store transiently (no subscription, no re-render).
  useFrame(() => {
    const light = keyRef.current;
    if (!light) return;
    const { sunMin, seasonProgress } = useSeasonalStore.getState();

    // Real sun position for the time-of-day.
    const sun = resolveSunLightPosition(lat, lng, sunMin, sunDist);
    const wFactor = winterFactor(seasonProgress);

    // Seasonal elevation: lower the sun in winter (0.45× altitude multiplier)
    // so shadows stretch long. Summer keeps full elevation (short, sharp).
    const altRad = (Math.max(sun.altitudeDeg, 3) * Math.PI) / 180;
    const seasonalAlt = altRad * (1 - wFactor * 0.55);
    const azRad = (sun.azimuthDeg * Math.PI) / 180;
    light.position.set(
      Math.cos(seasonalAlt) * Math.sin(azRad) * sunDist,
      Math.sin(seasonalAlt) * sunDist,
      -Math.cos(seasonalAlt) * Math.cos(azRad) * sunDist,
    );

    // Intensity tapers near sunrise/sunset, with a legibility floor — the
    // design must stay readable in autumn/winter light; season reads through
    // shadow length + canopy, not through murk. Winter dimming is mild (0.15).
    const altClamped = Math.max(sun.altitudeDeg, 0);
    const intensity =
      (0.75 + Math.min(altClamped / 60, 1) * 1.05) * (1 - wFactor * 0.15);
    light.intensity = intensity;
  });

  return (
    <>
      {/* Cool ambient — lifts shadow areas without flattening (proven GrowthStudio value). */}
      <ambientLight intensity={0.5} color={PALETTE.ambientCool} />
      {/* Sky-over-ground hemisphere — the olive ground-bounce is what makes canopy
          undersides and upfacing surfaces read naturalistic (green bounce). */}
      <hemisphereLight args={[PALETTE.skyCool, PALETTE.groundBounce, 0.65]} />
      {/* Warm key light — position + intensity mutated per-frame by the useFrame above */}
      <directionalLight
        ref={keyRef}
        intensity={1.4}
        color={PALETTE.sunWarm}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={scaleM * 4}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* Cool fill — lifts shadowed sides without flattening form (no shadow) */}
      <directionalLight
        position={[-scaleM * 0.5, scaleM * 0.6, -scaleM * 0.3]}
        intensity={0.28}
        color={PALETTE.skyCool}
      />
      {/* Rim / back-light — cool, from behind. Separates tree + building
          silhouettes from the fog, giving the scene edge definition. */}
      <directionalLight
        position={[0, scaleM * 0.7, -scaleM * 0.8]}
        intensity={0.4}
        color={PALETTE.rimCool}
      />
    </>
  );
}

/**
 * Seasonal fog controller — mutates scene.fog near/far per-frame so winter
 * pulls the fog closer (denser, colder atmosphere). Rule 4 atmospherics.
 * Zero React re-renders (reads via getState).
 */
function SeasonalFogController({ scaleM }: { scaleM: number }) {
  const scene = useThree((state) => state.scene);
  const baseNear = scaleM * 1.5;
  const baseFar = scaleM * 3.6;

  useFrame(() => {
    const fog = scene.fog;
    if (!(fog instanceof THREE.Fog)) return;
    const { seasonProgress } = useSeasonalStore.getState();
    const wFactor = winterFactor(seasonProgress);
    // Winter: pull fog 30% closer (denser). Summer: full distance.
    fog.near = baseNear * (1 - wFactor * 0.3);
    fog.far = baseFar * (1 - wFactor * 0.3);
  });

  return null;
}

/**
 * Blurred contact-shadow plane — the soft AO-style grounding that anchors
 * trees and building to the ground plane. Renders as a projection at y≈0.008
 * so it sits just above the ground material and below the geometry.
 */
function GroundContactShadows({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const size = Math.max(scaleM, scaleM * boardAspect) * 1.5;
  // Blueprint mode fades the heavy AO so the world reads flatter/vellum.
  // A single boolean toggle re-rendering this component is negligible cost.
  const subsurfaceView = useSeasonalStore((s) => s.subsurfaceView);
  return (
    <ContactShadows
      position={[0, 0.008, 0]}
      scale={size}
      blur={2.6}
      opacity={subsurfaceView ? 0.15 : 0.45}
      far={scaleM}
      resolution={1024}
      color={PALETTE.gsShadow}
    />
  );
}

/** The lot boundary — a Signal Blue line. Scene geometry follows the text
 *  law: --gs-ink-truth (#6B8EEA) on dark surfaces — measured 3.47:1 on the
 *  ground token (SC 1.4.11 non-text ≥3:1; truth-soft was 2.04:1 — fail). */
function LotBoundary({
  points,
  scaleM,
  boardAspect,
  sampler,
}: {
  points: PctPoint[];
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  // Draped: every point samples the terrain field + the semantic clearance,
  // so the title line rides the surface instead of intersecting it (the old
  // constant-z line buried up to 7.6 m on high ground / floated on low).
  const linePoints = drapeRingToSurface(points, {
    sampler,
    scaleM,
    boardAspect,
    offsetM: SPATIAL_LAYER.semantic.offsetM,
  });
  if (linePoints.length < 2) return null;
  return (
    <Line
      points={linePoints}
      color="#6B8EEA"
      lineWidth={2.5}
      renderOrder={SPATIAL_LAYER.semantic.renderOrder}
    />
  );
}

/** Easements — Signal Blue dashed lines (truth-soft for dark-ground visibility). */
function Easements({
  rings,
  scaleM,
  boardAspect,
  sampler,
}: {
  rings: PctPoint[][];
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  return (
    <>
      {rings.map((ring, i) => {
        if (ring.length < 2) return null;
        const pts = drapeRingToSurface(ring, {
          sampler,
          scaleM,
          boardAspect,
          offsetM: SPATIAL_LAYER.semantic.offsetM - 0.01,
        });
        return (
          <Line
            key={`easement-${i}`}
            points={pts}
            color="#6B8EEA"
            lineWidth={1}
            dashed
            dashSize={0.4}
            gapSize={0.3}
            opacity={0.5}
            transparent
            renderOrder={SPATIAL_LAYER.semantic.renderOrder}
          />
        );
      })}
    </>
  );
}

/** Services / utility corridors — coloured by APWA convention. */
function Services({
  lines,
  scaleM,
  boardAspect,
  sampler,
}: {
  lines: PctPoint[][];
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  const apwaColors = ["#1e88c7", "#2f8f4e", "#e8b000", "#d63b2f", "#e8722f"];
  return (
    <>
      {lines.map((line, i) => {
        if (line.length < 2) return null;
        const pts = drapeRingToSurface(line, {
          sampler,
          scaleM,
          boardAspect,
          offsetM: SPATIAL_LAYER.semantic.offsetM - 0.02,
        });
        return (
          <Line
            key={`service-${i}`}
            points={pts}
            color={apwaColors[i % apwaColors.length]}
            lineWidth={1.5}
            dashed
            dashSize={0.3}
            gapSize={0.2}
            renderOrder={SPATIAL_LAYER.semantic.renderOrder}
          />
        );
      })}
    </>
  );
}

/** The building footprint — a flat mesh with opacity. */
/**
 * The building — extruded from its footprint into a 3D mass with a flat roof
 * and warm window glow. Spec §2.2 calls for <StructureMesh> with height_m
 * extrusion; this delivers it. Default eave height matches the domain
 * boardShadowCast assumption (5.2m) when no height is provided.
 */
function BuildingFootprint({
  points,
  scaleM,
  boardAspect,
  opacity = 1,
  heightM = 5.2,
}: {
  points: PctPoint[];
  scaleM: number;
  boardAspect: number;
  opacity?: number;
  heightM?: number;
}) {
  const geo = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape();
    const world = points.map((p) => pctToWorld(p, scaleM, boardAspect));
    // Shape Y must be NEGATED world Z: the [-π/2, 0, 0] rotation maps local
    // +Y → world −Z, so (x, −z) in shape space lands at world (x, z) —
    // keeping the mass under its own ground outline instead of N/S-mirrored.
    shape.moveTo(world[0]![0], -world[0]![1]);
    for (let i = 1; i < world.length; i++)
      shape.lineTo(world[i]![0], -world[i]![1]);
    shape.closePath();
    // Extrude depth = building height. bevel gives a soft roof edge.
    return new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 2,
    });
  }, [points, scaleM, boardAspect, heightM]);

  // Footprint outline (flat, on the ground) — keeps the surveyor read.
  const outlinePoints = useMemo(() => {
    if (points.length < 2) return null;
    return points.map(
      (p) => [...pctToWorld(p, scaleM, boardAspect), 0.02] as [number, number, number],
    );
  }, [points, scaleM, boardAspect]);

  if (!geo) return null;
  return (
    <group>
      {/* Extruded mass — rotated so extrude depth (Z) points up (+Y).
          roughness/metalness tuned to catch environment reflections. */}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#1e2329"
          transparent
          opacity={opacity}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {/* Window glow band — a thin emissive strip around the upper wall,
          warm interior glow that the Bloom pass picks up at dusk. Sits just
          below the roof line. */}
      <mesh position={[0, heightM * 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 0.01, 4]} />
        <meshStandardMaterial
          color={PALETTE.windowGlow}
          emissive={PALETTE.windowGlow}
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </mesh>
      {/* Ground-footprint hairline — preserves the surveyor measurement read. */}
      {outlinePoints && outlinePoints.length >= 2 && (
        <Line points={outlinePoints} color="#1e2329" lineWidth={1.5} />
      )}
    </group>
  );
}

/** The ground plane — lit + shadow-receiving. When subsurfaceView is toggled,
 *  a useFrame loop lerps the material toward an architectural-vellum state
 *  (desaturated grey, slightly translucent, lower roughness) so the hairline
 *  CAD utility lines glow through the "paper." Reads as a blueprint overlay,
 *  not a space simulator. */
function GroundPlane({ scaleM, boardAspect }: { scaleM: number; boardAspect: number }) {
  const w = scaleM * 3;
  const h = scaleM * boardAspect * 3;
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const gridRef = useRef<THREE.GridHelper>(null);

  // Target colours (memoized so we don't allocate THREE.Color per frame).
  const colorOlive = useMemo(() => new THREE.Color(PALETTE.groundOlive), []);
  const colorVellum = useMemo(() => new THREE.Color(PALETTE.renderBlueprintGround), []);

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const { subsurfaceView } = useSeasonalStore.getState();
    const k = Math.min(1, delta * 4); // smooth transition speed

    const targetOpacity = subsurfaceView ? 0.88 : 1.0;
    const targetRoughness = subsurfaceView ? 0.6 : 0.92;
    const targetColor = subsurfaceView ? colorVellum : colorOlive;

    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, k);
    mat.roughness = THREE.MathUtils.lerp(mat.roughness, targetRoughness, k);
    mat.color.lerp(targetColor, k);

    // Fade the grid in blueprint mode so it doesn't fight the CAD lines.
    const grid = gridRef.current;
    if (grid) {
      const gridMat = grid.material as THREE.Material;
      const targetGridOpacity = subsurfaceView ? 0.15 : 0.6;
      gridMat.opacity = THREE.MathUtils.lerp(gridMat.opacity, targetGridOpacity, k);
    }
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          ref={matRef}
          color={PALETTE.groundOlive}
          roughness={0.92}
          metalness={0.02}
          transparent
          opacity={1}
        />
      </mesh>
      <gridHelper
        ref={gridRef}
        args={[w, Math.round(w), "#404A54", "#2C343C"]}
        position={[0, 0.001, 0]}
      />
    </>
  );
}

/**
 * Aerial underlay — the site photo rendered as a texture on a plane just above
 * the ground. In plan view (blend≈0) it's fully opaque (the photo reads as the
 * drawing surface, like the old sketch pad). As the camera transitions to 3D
 * (blend→1), the aerial fades out so the 3D geometry/textures take over.
 *
 * Rendered as a real scene-graph texture — no DOM layer to swap, no hard cut.
 */
function AerialUnderlay({
  aerialUri,
  scaleM,
  boardAspect,
  heightmapPoints,
}: {
  aerialUri: string | null;
  scaleM: number;
  boardAspect: number;
  heightmapPoints: HeightmapPoint[];
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => {
    if (!aerialUri) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(aerialUri);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [aerialUri]);
  // Draped: on terrain projects the photo rides the SAME displaced geometry
  // as the ground (shared builder) instead of sinking under raised ground.
  const flatGeometry = useMemo(
    () => new THREE.PlaneGeometry(scaleM, scaleM * boardAspect),
    [scaleM, boardAspect],
  );
  const geometry = useMemo(
    () =>
      buildTerrainGeometry(scaleM, boardAspect, heightmapPoints) ??
      flatGeometry,
    [flatGeometry, scaleM, boardAspect, heightmapPoints],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    // Fade out as we transition to 3D. At blend=0: opacity 0.85 (photo visible).
    // At blend=1: opacity 0 (photo gone, 3D geometry visible).
    const { viewBlendTarget } = useSeasonalStore.getState();
    const targetOpacity = 0.85 * (1 - viewBlendTarget);
    const k = Math.min(1, delta * 4);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, k);
  });

  if (!texture) return null;
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SPATIAL_LAYER.draped.offsetM, 0]}
      renderOrder={SPATIAL_LAYER.draped.renderOrder}
    >
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function StudioScene({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct = [],
  servicesPct = [],
  items = [],
  buildingOpacity = 1,
  cameraRig,
  viewBlendLocked,
  onRigChange,
  onGroundClick,
  onCursorMove,
  subsurfaceUtilities,
  strikeAlerts,
  lens,
  growthFactor,
  lat = DEFAULT_SUN_LAT,
  lng = DEFAULT_SUN_LNG,
  // sunMin is read from the store by SunRig (not used directly here), but kept
  // in the props for API completeness / future direct-pass use.
  sunMin: _sunMin = 12 * 60,
  aerialUri = null,
  heightmapPoints = [],
}: StudioSceneProps) {
  // Subscribe to the view blend target — drives the editing-lock for controls
  // (editing is disabled when the camera is in 3D perspective mode).
  const viewBlendTarget = useSeasonalStore((s) => s.viewBlendTarget);

  // THE terrain field — one sampler, every spatial layer samples it (mesh,
  // semantic lines, aerial). Null on flat projects (no levels).
  const elevationSampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  return (
    <>
      {/* Note: soft shadows come from VSMShadowMap (set in WebGLStudio
          onCanvasCreated) + the ContactShadows plane below. The drei
          <SoftShadows> PCSS shader is incompatible with VSM shadow maps
          (it expects PCF), so it is intentionally NOT used here. */}

      {/* Real-sun lighting rig — key light position + intensity mutated per-frame
          via getState (sunMin + seasonProgress). Seasonal elevation lowers the
          sun in winter for long shadows. */}
      <SunRig
        scaleM={scaleM}
        boardAspect={boardAspect}
        lat={lat}
        lng={lng}
      />
      {/* Seasonal fog — pulls fog closer in winter (denser atmosphere). */}
      <SeasonalFogController scaleM={scaleM} />

      <FusedCamera
        rig={cameraRig}
        scaleM={scaleM}
        boardAspect={boardAspect}
        viewBlendLocked={viewBlendLocked}
      />

      {/* Input capture — invisible ground plane for raycasting.
          Editing is locked when the camera is in 3D mode (viewBlend > 0.5). */}
      {onRigChange && (
        <StudioControls
          scaleM={scaleM}
          boardAspect={boardAspect}
          rig={cameraRig}
          onRigChange={onRigChange}
          onGroundClick={onGroundClick}
          onCursorMove={onCursorMove}
          tiltLocked={viewBlendTarget > 0.5}
        />
      )}

      {/* Ground — real terrain mesh when spot levels exist, flat plane otherwise. */}
      {heightmapPoints.length > 0 ? (
        <TerrainMesh scaleM={scaleM} boardAspect={boardAspect} heightmapPoints={heightmapPoints} />
      ) : (
        <GroundPlane scaleM={scaleM} boardAspect={boardAspect} />
      )}
      {/* Elevation Slice — draggable section-cut line (Vertical Truth). Only
          mounts when terrain exists; the DOM profile panel is in WebGLStudioPreview. */}
      {heightmapPoints.length > 0 && (
        <ElevationSliceLine
          scaleM={scaleM}
          boardAspect={boardAspect}
          heightmapPoints={heightmapPoints}
        />
      )}
      {/* Drainage overland flow — D8 streams + ponding markers on the terrain
          (self-gates on drainageView; DOM telemetry card in WebGLStudioPreview). */}
      {heightmapPoints.length > 0 && (
        <DrainageFlowLayer
          scaleM={scaleM}
          boardAspect={boardAspect}
          heightmapPoints={heightmapPoints}
        />
      )}
      {/* Earthworks — committed pad masses + cut/fill zones (self-gates on
          earthworksView + the presence of extruded strokes). */}
      {heightmapPoints.length > 0 && (
        <EarthworksLayer
          scaleM={scaleM}
          boardAspect={boardAspect}
          heightmapPoints={heightmapPoints}
        />
      )}
      {/* Working-drawing dimension ring (boundary B… + building F…) —
          self-gates on dimsView; stays visible in Presentation mode. */}
      <DimensionLayer
        boundaryPct={boundaryPct}
        buildingPct={buildingPct}
        scaleM={scaleM}
        boardAspect={boardAspect}
      />
      {/* Measure tape — armed tool, self-gates on measureActive. */}
      <MeasureTapeLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
      />
      {/* Asset placement — armed fan-out symbol, self-gates on armedSymbolId. */}
      <AssetPlaceLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Flora ring — ranked suggestions at a click (self-gates on the
          session; candidates derive from lat/lng + live sun + placements). */}
      <FloraRingLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        lat={lat}
        lng={lng}
      />
      {/* Aerial photo underlay — opaque in plan view, fades in 3D. */}
      <AerialUnderlay aerialUri={aerialUri} scaleM={scaleM} boardAspect={boardAspect} heightmapPoints={heightmapPoints} />
      {/* Soft AO-style grounding — blurred contact shadows anchor geometry to the
          drawing surface, complementing the directional sun shadows. */}
      <GroundContactShadows scaleM={scaleM} boardAspect={boardAspect} />
      <OriginPeg sampler={elevationSampler} />
      <LotBoundary points={boundaryPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      {buildingPct && buildingPct.length >= 3 && (
        <BuildingFootprint
          points={buildingPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
          opacity={buildingOpacity}
        />
      )}
      {!lens?.hideEasements && (
        <Easements rings={easementsPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      )}
      {!lens?.hideServices && (
        <Services lines={servicesPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      )}
      <SceneItems
        items={items}
        scaleM={scaleM}
        boardAspect={boardAspect}
        hideTpz={lens?.hideTpz}
        growthFactor={growthFactor}
      />
      {subsurfaceUtilities && !lens?.hideSubsurface && (
        <SubsurfaceEngine
          utilities={subsurfaceUtilities}
          alerts={lens?.hideStrikes ? [] : strikeAlerts}
        />
      )}
      {/* Fused Sketch Layer — the shared 2D↔3D ink system. Self-mounts when
          sketchMode is on (reads the store internally). Strokes live in the
          unified store (CanvasStroke[] in board-% space) and render in BOTH
          plan and 3D views — no separate SVG surface. */}
      <FusedSketchLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
      />
    </>
  );
}

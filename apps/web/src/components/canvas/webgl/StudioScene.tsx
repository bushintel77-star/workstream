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
import { useFrame } from "@react-three/fiber";
import { Line, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type {
  DesignKeylessOverlay,
  DesignNeighbourBuilding,
} from "@workstream/contracts";
import {
  createElevationSampler,
  drapeRingToSurface,
  GROUND_CONTEXT_EXTENT,
} from "./terrainMath";
import { SPATIAL_LAYER } from "./layerContract";
import type { CanvasLayerPolicy } from "./layerPolicy";
import { resolveSunLightPosition } from "./sunLight";
import { PALETTE } from "../../../styles/colorTokens";
import { useSeasonalStore } from "./seasonalStore";
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
import { TrenchLayer } from "./TrenchLayer";
import { IrrigationZoneLayer } from "./IrrigationZoneLayer";
import { AssetPlaceLayer } from "./AssetPlaceLayer";
import { FloraRingLayer } from "./FloraRingLayer";
import { type PresentationLensFilter } from "./PresentationLens";

export interface StudioSceneProps {
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
  /** Project latitude (decimal degrees) for real-sun lighting. */
  lat?: number;
  /** Project longitude (decimal degrees) for real-sun lighting. */
  lng?: number;
  /** Minutes past Melbourne midnight — the time-of-day the sun is sampled at. */
  sunMin?: number;
  /** Mode-driven layer policy — backgrounds + data layer visibility. */
  layerPolicy?: CanvasLayerPolicy;
  /** Spot level sample points for the terrain heightmap (world space). */
  heightmapPoints?: HeightmapPoint[];
  /** Independent authored-ink visibility for layer separation. */
  showSketch?: boolean;
  /** Co-registered Victorian government/council constraint overlays. */
  keylessOverlays?: DesignKeylessOverlay[];
  /** Real neighbouring footprints; height is rendered only when supplied. */
  neighbourBuildings?: DesignNeighbourBuilding[];
}

/** Signal Blue origin peg — a crosshair at (0,0,0). */
function OriginPeg({
  sampler,
}: {
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  // --gs-truth stroke — the origin crosshair reads against the paper ground.
  const blue = "#0030CF";
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
 * Real-sun lighting rig — warm sun key + cool sky bounce + soft fill + rim.
 *
 * The key light's position + intensity are mutated every frame inside useFrame
 * (reading sunMin + sunDatePreset via getState — zero React re-renders).
 * Position comes from the real solar position (`sunPositionAt`) for the project
 * lat/lng at the sampled date; a low winter sun casts the long, soft shadows
 * the 2D `boardShadowCast` also models. The seasonal variation is REAL — the
 * winter solstice noon altitude is naturally lower than the summer solstice —
 * so no altitude multiplier is applied on top (see ./sunLight).
 *
 * Light tints resolve to render tokens, not raw hex. Convention: +X east, +Y up,
 * +Z south (north = -Z), matching GrowthStudioClient.
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
    const { sunMin, sunDatePreset } = useSeasonalStore.getState();

    // Real sun position for the time-of-day + calendar preset — the SAME
    // (sunDatePreset, sunMin) axis the season is derived from.
    // The returned position already applies the grazing-sun floor (see ./sunLight).
    const sun = resolveSunLightPosition(lat, lng, sunDatePreset, sunMin, sunDist);
    light.position.set(sun.position[0], sun.position[1], sun.position[2]);

    // Intensity tapers near sunrise/sunset, with a legibility floor — the
    // design must stay readable in autumn/winter light; season reads through
    // shadow length + canopy, not through murk. Winter noon is naturally
    // dimmer because the real altitude is lower (no extra seasonal dimming).
    const altClamped = Math.max(sun.altitudeDeg, 0);
    const intensity =
      0.9 + Math.min(altClamped / 60, 1) * 1.1;
    light.intensity = intensity;
  });

  return (
    <>
      {/* Cool ambient — lifts shadow areas without flattening (proven GrowthStudio value). */}
      <ambientLight intensity={0.7} color={PALETTE.ambientCool} />
      {/* Sky-over-ground hemisphere — the olive ground-bounce is what makes canopy
          undersides and upfacing surfaces read naturalistic (green bounce). */}
      <hemisphereLight args={[PALETTE.skyCool, PALETTE.groundBounce, 0.85]} />
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
        intensity={0.4}
        color={PALETTE.skyCool}
      />
      {/* Rim / back-light — cool, from behind. Separates tree + building
          silhouettes from the fog, giving the scene edge definition. */}
      <directionalLight
        position={[0, scaleM * 0.7, -scaleM * 0.8]}
        intensity={0.28}
        color={PALETTE.rimCool}
      />
    </>
  );
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

/** The lot boundary — a Signal Blue line. Scene geometry follows the data
 *  law: --gs-truth (#0030CF) strokes on paper — 8.22:1 on the canvas token
 *  (SC 1.4.11 non-text ≥3:1; the dark-era lifted ink #6B8EEA failed on paper). */
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
      color="#0030CF"
      lineWidth={2.5}
      renderOrder={SPATIAL_LAYER.semantic.renderOrder}
    />
  );
}

/** Easements — Signal Blue dashed lines (#0030CF reads on every ground state). */
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
            color="#0030CF"
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

const OVERLAY_COLORS: Record<DesignKeylessOverlay["kind"], string> = {
  planning: PALETTE.cobaltD400,
  bushfire: PALETTE.warningD400,
  contour: PALETTE.grayD500,
  flood: PALETTE.waterD400,
  heritage: PALETTE.autumnOrange,
  easement: PALETTE.slateD400,
  urban_tree: PALETTE.forestD400,
  water_corp: PALETTE.apwaWater,
  road_casement: PALETTE.bluestoneD300,
  acid_sulfate: PALETTE.warningD400,
  wetland: PALETTE.waterD400,
};

function GovernmentOverlays({
  overlays,
  scaleM,
  boardAspect,
  sampler,
}: {
  overlays: DesignKeylessOverlay[];
  scaleM: number;
  boardAspect: number;
  sampler: ((worldX: number, worldZ: number) => number) | null;
}) {
  return (
    <>
      {overlays.flatMap((overlay, overlayIndex) =>
        overlay.rings.map((ring, ringIndex) => {
          if (ring.length < 2) return null;
          const points = drapeRingToSurface(
            ring.map((point) => ({ x: point.x_pct, y: point.y_pct })),
            {
              sampler,
              scaleM,
              boardAspect,
              offsetM: SPATIAL_LAYER.semantic.offsetM + 0.01,
            },
          );
          return (
            <Line
              key={`${overlay.kind}-${overlayIndex}-${ringIndex}`}
              points={points}
              color={OVERLAY_COLORS[overlay.kind]}
              lineWidth={1.5}
              dashed
              dashSize={0.32}
              gapSize={0.2}
              transparent
              opacity={0.85}
              renderOrder={SPATIAL_LAYER.semantic.renderOrder}
            />
          );
        }),
      )}
    </>
  );
}

/** The building footprint — a flat mesh with opacity. */
/**
 * The building — extruded from its footprint into a 3D mass with a flat roof
 * and a cadastral footprint slab when height is unknown. Spec §2.2 calls for
 * <StructureMesh> with height_m extrusion; no height is invented here.
 */
function BuildingFootprint({
  points,
  scaleM,
  boardAspect,
  opacity = 1,
  heightM = 0.15,
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
    // Never invent a building height. Without measured/operator height this is
    // a low cadastral footprint slab; supplied heights render true massing.
    return new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: true,
      bevelThickness: Math.min(0.08, heightM / 4),
      bevelSize: Math.min(0.08, heightM / 4),
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
          color={PALETTE.concrete}
          transparent
          opacity={opacity}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {/* Ground-footprint hairline — preserves the surveyor measurement read. */}
      {outlinePoints && outlinePoints.length >= 2 && (
        <Line points={outlinePoints} color={PALETTE.grayL700} lineWidth={1.5} />
      )}
    </group>
  );
}

function NeighbourBuildings({
  buildings,
  scaleM,
  boardAspect,
}: {
  buildings: DesignNeighbourBuilding[];
  scaleM: number;
  boardAspect: number;
}) {
  return (
    <>
      {buildings.map((building) => (
        <BuildingFootprint
          key={building.id}
          points={building.ring.map((point) => ({
            x: point.x_pct,
            y: point.y_pct,
          }))}
          scaleM={scaleM}
          boardAspect={boardAspect}
          heightM={building.height_m ?? 0.15}
          opacity={building.height_m == null ? 0.28 : 0.45}
        />
      ))}
    </>
  );
}

/** The ground plane — lit + shadow-receiving. When subsurfaceView is toggled,
 *  a useFrame loop lerps the material toward an architectural-vellum state
 *  (desaturated grey, slightly translucent, lower roughness) so the hairline
 *  CAD utility lines glow through the "paper." Reads as a blueprint overlay,
 *  not a space simulator. */
function GroundPlane({
  scaleM,
  boardAspect,
  draftingSurface = false,
}: {
  scaleM: number;
  boardAspect: number;
  draftingSurface?: boolean;
}) {
  const w = scaleM * GROUND_CONTEXT_EXTENT;
  const h = scaleM * boardAspect * GROUND_CONTEXT_EXTENT;
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const gridRef = useRef<THREE.GridHelper>(null);

  // Target colours (memoized so we don't allocate THREE.Color per frame).
  const colorOlive = useMemo(() => new THREE.Color(PALETTE.groundOlive), []);
  const colorVellum = useMemo(() => new THREE.Color(PALETTE.renderBlueprintGround), []);
  const colorDrafting = useMemo(() => new THREE.Color(PALETTE.draftingGrey), []);

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const { subsurfaceView } = useSeasonalStore.getState();
    const k = Math.min(1, delta * 4); // smooth transition speed

    const targetOpacity = subsurfaceView ? 0.88 : 1.0;
    const targetRoughness = subsurfaceView ? 0.6 : 0.92;
    const targetColor = draftingSurface
      ? colorDrafting
      : subsurfaceView
        ? colorVellum
        : colorOlive;

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
        args={[w, Math.round(w), "#FFFFFF", "#D4D4D4"]}
        position={[0, 0.001, 0]}
      />
    </>
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
  viewBlendLocked,
  onGroundClick,
  onCursorMove,
  subsurfaceUtilities,
  strikeAlerts,
  lens,
  growthFactor,
  lat,
  lng,
  // sunMin is read from the store by SunRig (not used directly here), but kept
  // in the props for API completeness / future direct-pass use.
  sunMin: _sunMin = 12 * 60,
  layerPolicy,
  heightmapPoints = [],
  keylessOverlays = [],
  neighbourBuildings = [],
  showSketch = true,
}: StudioSceneProps) {
  // Default policy keeps every mode's legacy behaviour when unset.
  const policy: CanvasLayerPolicy = layerPolicy ?? {
    subsurface: false,
    utilities: true,
    easements: true,
    draftingSurface: false,
  };
  // Subscribe to the view blend target — drives the editing-lock for controls
  // (editing is disabled when the camera is in 3D perspective mode, and
  // re-enabled only at the exact elevation snap: φ=90° + facade normal).
  const viewBlendTarget = useSeasonalStore((s) => s.viewBlendTarget);
  const elevationActive = useSeasonalStore((s) => s.elevationActive);

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
          via getState (sunMin + sunDatePreset). Winter shadows are longer
          because the sampled date's real declination lowers the winter sun. */}
      {lat != null && lng != null ? (
        <SunRig
          scaleM={scaleM}
          boardAspect={boardAspect}
          lat={lat}
          lng={lng}
        />
      ) : (
        <>
          <ambientLight intensity={0.8} color={PALETTE.ambientCool} />
          <hemisphereLight args={[PALETTE.skyCool, PALETTE.groundBounce, 0.9]} />
        </>
      )}
      <FusedCamera
        scaleM={scaleM}
        boardAspect={boardAspect}
        viewBlendLocked={viewBlendLocked}
      />

      {/* Input capture — invisible ground plane for raycasting.
          Editing is locked in 3D (viewBlend > 0.5) and re-enabled only at
          the exact orthographic elevation snap (φ=90° + facade normal). */}
      <StudioControls
        scaleM={scaleM}
        boardAspect={boardAspect}
        onGroundClick={onGroundClick}
        onCursorMove={onCursorMove}
        tiltLocked={viewBlendTarget > 0.5 && !elevationActive}
      />

      {/* Ground — real terrain mesh when spot levels exist, flat plane otherwise. */}
      {heightmapPoints.length > 0 ? (
        <TerrainMesh scaleM={scaleM} boardAspect={boardAspect} heightmapPoints={heightmapPoints} draftingSurface={policy.draftingSurface} />
      ) : (
        <GroundPlane scaleM={scaleM} boardAspect={boardAspect} draftingSurface={policy.draftingSurface} />
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
      {/* Trench trace — armed tool; a drag traces a run that commits as a
          ConstructionTrench (source: traced). Easements are no-dig rings. */}
      <TrenchLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
        noDigRingsPct={easementsPct}
      />
      {/* Irrigation zones — armed tool; a drag closes a ring that commits as
          an IrrigationZone with live area + flow readout. */}
      <IrrigationZoneLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Asset placement — armed fan-out symbol, self-gates on armedSymbolId. */}
      <AssetPlaceLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Flora ring — ranked suggestions at a click (self-gates on the
          session; candidates derive from lat/lng + live sun + placements). */}
      {lat != null && lng != null ? (
        <FloraRingLayer
          scaleM={scaleM}
          boardAspect={boardAspect}
          lat={lat}
          lng={lng}
        />
      ) : null}
      {/* Soft AO-style grounding — blurred contact shadows anchor geometry to the
          drawing surface, complementing the directional sun shadows. */}
      <GroundContactShadows scaleM={scaleM} boardAspect={boardAspect} />
      <OriginPeg sampler={elevationSampler} />
      <LotBoundary points={boundaryPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      <GovernmentOverlays
        overlays={keylessOverlays}
        scaleM={scaleM}
        boardAspect={boardAspect}
        sampler={elevationSampler}
      />
      {buildingPct && buildingPct.length >= 3 && (
        <BuildingFootprint
          points={buildingPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
          opacity={buildingOpacity}
        />
      )}
      <NeighbourBuildings
        buildings={neighbourBuildings}
        scaleM={scaleM}
        boardAspect={boardAspect}
      />
      {!lens?.hideEasements && policy.easements && (
        <Easements rings={easementsPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      )}
      {!lens?.hideServices && policy.utilities && (
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
      {showSketch ? (
        <FusedSketchLayer
          scaleM={scaleM}
          boardAspect={boardAspect}
          heightmapPoints={heightmapPoints}
        />
      ) : null}
    </>
  );
}

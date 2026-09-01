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
  CatalogPlacement,
  ConstructionTrench,
  DesignKeylessOverlay,
  DesignNeighbourBuilding,
  DesignSiteFrameLevel,
  IrrigationZone,
  LandscapeFeature,
} from "@workstream/contracts";
import {
  createElevationSampler,
  drapeRingToSurface,
  GROUND_CONTEXT_EXTENT,
} from "./terrainMath";
import { SPATIAL_LAYER } from "./layerContract";
import type { CanvasLayerPolicy } from "./layerPolicy";
import { getLayerStyle, layerYOffset } from "@workstream/domain";
import { resolveSunLightPosition } from "./sunLight";
import { PALETTE } from "../../../styles/colorTokens";
import { useSeasonalStore } from "./seasonalStore";
import { pctToWorld, type PctPoint, type HeightmapPoint } from "./coordTransform";
import { normalizeBox } from "./marqueeSelect";
import { SceneItems, type RenderItem } from "./sceneItems";
import { StudioControls } from "./StudioControls";
import { SubsurfaceEngine, type SubsurfaceUtility, type StrikeAlertData } from "./features/SubsurfaceEngine";
import { FusedCamera } from "./FusedCamera";
import { FlythroughRig } from "./FlythroughRig";
import { PedestrianCamera } from "./PedestrianCamera";
import { FusedSketchLayer } from "./FusedSketchLayer";
import { StrokeTransferLayer } from "./StrokeTransferLayer";
import { StitchSnapLayer } from "./StitchSnapLayer";
import { PhotoTracePlane } from "./PhotoTracePlane";
import { PlacementGizmo } from "./PlacementGizmo";
import { TerrainMesh } from "./TerrainMesh";
import { SuncastOverlay } from "./SuncastOverlay";
import { DottedGroundField } from "./DottedGroundField";
import { ElevationSliceLine } from "./ElevationSliceLine";
import { DrainageFlowLayer } from "./DrainageFlowLayer";
import { EarthworksLayer } from "./EarthworksLayer";
import { DimensionLayer } from "./DimensionLayer";
import { MetaChipSet } from "./MetaChipSet";
import {
  BoundaryProjectionProbe,
  BOUNDARY_PROBE_ENABLED,
} from "./BoundaryProjectionProbe";
import { buildCanopyCompliance } from "./canopyCompliance";
import { buildStudioSiteEnvelope } from "./siteEnvelope";
import { buildScanChoreography } from "./scanChoreography";
import { ScanRevealDirector, scanReveal } from "./scanReveal";
import { buildMetaChips } from "./metaChips";
import { MeasureTapeLayer } from "./MeasureTapeLayer";
import { DraftShapeLayer } from "./DraftShapeLayer";
import { TrenchLayer } from "./TrenchLayer";
import { IrrigationZoneLayer } from "./IrrigationZoneLayer";
import { AssetPlaceLayer } from "./AssetPlaceLayer";
import { PlantSpacingGuideLayer } from "./PlantSpacingGuideLayer";
import { FloraRingLayer } from "./FloraRingLayer";
import { FeatureLayer } from "./FeatureLayer";
import { CadProposalLayer } from "./CadProposalLayer";
import { SetbackBoundaryLayer } from "./SetbackBoundaryLayer";
import { type PresentationLensFilter } from "./PresentationLens";
import { AnnotationLayer } from "./annotations/AnnotationLayer";
import type { AnnotationDialect } from "./annotations/model";
import type { SurveyedPlanLayers } from "./studioStore";
import { useStudioStore } from "./studioStore";
import { TradeAnnotationLayer } from "./annotations/TradeAnnotationLayer";

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
  /** Click on empty ground — carries the shift-key additive flag for selection. */
  onGroundClick?: (pct: PctPoint, opts: { additive: boolean }) => void;
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
  /** Active canvas mode — drives the meta chip-set's phase illumination. */
  mode?: string;
  /** Cadastral/environmental records for the ambient meta chip-set. */
  siteMeta?: {
    titleRef?: string | null;
    lga?: string | null;
    lotAreaM2?: number | null;
    sunHours?: number | null;
  };
  /** True-north bearing of board-up, when calibrated (deg clockwise). */
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
  drafting,
}: {
  scaleM: number;
  boardAspect: number;
  lat: number;
  lng: number;
  /** Drafting (paper) mode — the ground must read as a flat neutral
   *  drawing board, not a warm sunlit site. Switches the key to neutral
   *  daylight and drops the olive ground-bounce so #F4F4F4 stays #F4F4F4. */
  drafting?: boolean;
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
    //
    // Drafting mode caps the key much lower and keeps it even, so a #F4F4F4
    // sheet stays neutral instead of being driven warm toward khaki. A
    // drafting board is lit evenly, not by a low warm sun.
    const altClamped = Math.max(sun.altitudeDeg, 0);
    const intensity = drafting
      ? 0.55 + Math.min(altClamped / 60, 1) * 0.25
      : 0.9 + Math.min(altClamped / 60, 1) * 1.1;
    light.intensity = intensity;
    // Neutral white key in drafting mode — the warm cream tint is what turns
    // paper khaki. Shadow shape still reads relief; colour stays neutral.
    light.color.set(drafting ? "#FFFFFF" : PALETTE.sunWarm);
  });

  return (
    <>
      {/* Cool ambient — lifts shadow areas without flattening (proven GrowthStudio value).
          Drafting mode neutralises it (white, slightly stronger) so paper holds its tone. */}
      <ambientLight
        intensity={drafting ? 0.95 : 0.7}
        color={drafting ? "#FFFFFF" : PALETTE.ambientCool}
      />
      {/* Sky-over-ground hemisphere — the olive ground-bounce is what makes canopy
          undersides and upfacing surfaces read naturalistic (green bounce). Drafting
          mode flattens it to neutral so the sheet does not pick up olive. */}
      <hemisphereLight
        args={drafting ? ["#FFFFFF", "#FFFFFF", 0.6] : [PALETTE.skyCool, PALETTE.groundBounce, 0.85]}
      />
      {/* Key light — position + intensity mutated per-frame by the useFrame above */}
      <directionalLight
        ref={keyRef}
        intensity={drafting ? 0.8 : 1.4}
        color={drafting ? "#FFFFFF" : PALETTE.sunWarm}
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
      {/* Cool fill — lifts shadowed sides without flattening form (no shadow).
          Drafting mode neutralises it to keep the sheet even. */}
      <directionalLight
        position={[-scaleM * 0.5, scaleM * 0.6, -scaleM * 0.3]}
        intensity={drafting ? 0.35 : 0.4}
        color={drafting ? "#FFFFFF" : PALETTE.skyCool}
      />
      {/* Rim / back-light — cool, from behind. Separates tree + building
          silhouettes from the fog, giving the scene edge definition. */}
      <directionalLight
        position={[0, scaleM * 0.7, -scaleM * 0.8]}
        intensity={drafting ? 0.2 : 0.28}
        color={drafting ? "#FFFFFF" : PALETTE.rimCool}
      />
    </>
  );
}

/**
 * Spatial Sketching — anti-void ground shadow. A subtle dark radial gradient
 * mesh flat on the world ground (Y=0.004, just above the ground plane). This
 * anchors the user's peripheral vision and establishes a horizon floor without
 * adding heavy grid lines. Per the design handoff §5.1: "ground shadow under
 * the plane stack" as a "down" cue.
 */
function GroundShadow({ scaleM }: { scaleM: number }) {
  const size = scaleM * 3;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color("#000000") },
          uOpacity: { value: 0.3 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            float dist = distance(vUv, vec2(0.5));
            float alpha = smoothstep(0.5, 0.0, dist) * uOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={material}>
      <circleGeometry args={[size, 64]} />
    </mesh>
  );
}

/**
 * Horizon line (pack S5.1 / card 2d) -- a thin scene-space ring at the
 * board perimeter that reads as the horizon when the camera tilts to
 * oblique/perspective. Fades to invisible in plan view (tiltDeg < 5).
 * Scene-space: lives inside the R3F canvas, not the DOM overlay.
 */
function HorizonLine({ scaleM, boardAspect }: { scaleM: number; boardAspect: number }) {
  const tiltDeg = useStudioStore((s) => s.liveRig.tiltDeg);
  const opacity = Math.max(0, Math.min(0.25, (tiltDeg - 5) / 50 * 0.25));
  const halfW = scaleM / 2;
  const halfH = (scaleM * boardAspect) / 2;
  const points = useMemo(() => {
    const r = Math.max(halfW, halfH) * 1.4;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push([Math.cos(a) * r, 0.006, Math.sin(a) * r]);
    }
    return pts;
  }, [halfW, halfH]);

  if (opacity < 0.01) return null;

  return (
    <Line
      points={points}
      color="#1C1917"
      transparent
      opacity={opacity}
      lineWidth={1}
    />
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
  // Style + clearance come from the Domain Layer Registry — no hardcoded hex.
  const linePoints = drapeRingToSurface(points, {
    sampler,
    scaleM,
    boardAspect,
    offsetM: layerYOffset("cadastre.title_boundary"),
  });
  // Scan reveal: the title line draws on (opacity per the cadastre stage).
  const lineRef = useRef<React.ComponentRef<typeof Line> | null>(null);
  useFrame(() => {
    const mat = lineRef.current?.material;
    if (mat) mat.opacity = scanReveal.cadastre;
  });
  if (linePoints.length < 2) return null;
  return (
    <Line
      ref={lineRef}
      points={linePoints}
      color={getLayerStyle("cadastre.title_boundary").color}
      lineWidth={getLayerStyle("cadastre.title_boundary").lineWidthPx}
      transparent
      renderOrder={SPATIAL_LAYER.semantic.renderOrder}
    />
  );
}

/** Live marquee drag box — a dashed Primary Signal Blue rectangle riding
 *  the semantic clearance height, so it reads above terrain like the title
 *  line. Only mounted while the marquee tool drag is in flight. */
function MarqueeBoxLayer({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const draft = useSeasonalStore((s) => s.marqueeDraft);
  if (!draft) return null;
  const box = normalizeBox(draft.a, draft.b);
  const corners: PctPoint[] = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
    { x: box.x0, y: box.y0 },
  ];
  const world = corners.map((p) => {
    const [x, z] = pctToWorld(p, scaleM, boardAspect);
    return [x, SPATIAL_LAYER.semantic.offsetM, z] as [number, number, number];
  });
  return (
    <Line
      points={world}
      color="#3D5AFE"
      lineWidth={1.5}
      dashed
      dashSize={0.35}
      gapSize={0.25}
      renderOrder={SPATIAL_LAYER.semantic.renderOrder + 1}
    />
  );
}

/** Easements — registry-styled dashed servitudes (distinct cobalt stroke,
 *  clear of the trench tier — the depth audit's y=0.05 z-fight pair). */
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
  const style = getLayerStyle("vicmap.easement");
  // Scan reveal: servitude lines fade in under the services stage while the
  // dashes creep (the ant-path language the subsurface conduits established).
  const lineRefs = useRef(
    new Map<number, React.ComponentRef<typeof Line>>(),
  );
  useFrame((_, delta) => {
    for (const line of lineRefs.current.values()) {
      line.material.opacity = style.opacity * scanReveal.services;
      if (scanReveal.services < 1) {
        line.material.dashOffset -= delta * 0.3;
      }
    }
  });
  return (
    <>
      {rings.map((ring, i) => {
        if (ring.length < 2) return null;
        const pts = drapeRingToSurface(ring, {
          sampler,
          scaleM,
          boardAspect,
          offsetM: layerYOffset("vicmap.easement"),
        });
        return (
          <Line
            key={`easement-${i}`}
            ref={(el) => {
              if (el) lineRefs.current.set(i, el);
              else lineRefs.current.delete(i);
            }}
            points={pts}
            color={style.color}
            lineWidth={style.lineWidthPx}
            dashed
            dashSize={style.dashArray?.[0] ?? 0.4}
            gapSize={style.dashArray?.[1] ?? 0.3}
            opacity={style.opacity}
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
          offsetM: layerYOffset("services.gas"),
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
  planning: PALETTE.cobaltL600,
  bushfire: PALETTE.warningL500,
  contour: PALETTE.grayL300,
  flood: PALETTE.waterL500,
  heritage: PALETTE.autumnOrange,
  easement: PALETTE.slateL500,
  urban_tree: PALETTE.forestL600,
  water_corp: PALETTE.apwaWater,
  road_casement: PALETTE.bluestoneL400,
  acid_sulfate: PALETTE.warningL500,
  wetland: PALETTE.waterL500,
  native_vegetation: PALETTE.sproutL500,
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
              offsetM: layerYOffset("vicmap.gov_overlay"),
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
  // Clearance from the Domain Layer Registry (deterministic y-bias).
  const outlinePoints = useMemo(() => {
    if (points.length < 2) return null;
    return points.map(
      (p) =>
        [
          ...pctToWorld(p, scaleM, boardAspect),
          layerYOffset("cadastre.building_footprint"),
        ] as [number, number, number],
    );
  }, [points, scaleM, boardAspect]);

  // Scan reveal: the mass extrudes up (scale-Y 0.04 → 1) under the parcels
  // stage — the target height is ALWAYS the data's own (never invented).
  // (Hooks stay above the early return — React rules.)
  const massRef = useRef<THREE.Group | null>(null);
  useFrame(() => {
    const g = massRef.current;
    if (g) g.scale.y = 0.04 + 0.96 * scanReveal.parcels;
  });

  if (!geo) return null;
  return (
    <group>
      {/* Extruded mass — rotated so extrude depth (Z) points up (+Y).
          roughness/metalness tuned to catch environment reflections. */}
      <group ref={massRef}>
        <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial
            color={PALETTE.concrete}
            transparent
            opacity={opacity}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
      </group>
      {/* Ground-footprint hairline — preserves the surveyor measurement read. */}
      {outlinePoints && outlinePoints.length >= 2 && (
        <Line
          points={outlinePoints}
          color={getLayerStyle("cadastre.building_footprint").color}
          lineWidth={getLayerStyle("cadastre.building_footprint").lineWidthPx}
        />
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
}: {
  scaleM: number;
  boardAspect: number;
  groundAlbedo?: CanvasLayerPolicy["groundAlbedo"];
}) {
  // Infinite ground — 10x the context extent so zoom-out never hits an edge.
  const w = scaleM * GROUND_CONTEXT_EXTENT * 10;
  const h = scaleM * boardAspect * GROUND_CONTEXT_EXTENT * 10;

  return (
    <>
      {/* Invisible shadow-catching plane -- ShadowMaterial renders only the
          shadows cast by the sun rig, never an albedo. The brown box is gone;
          the ground blends seamlessly into the scene background. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>
      {/* Dotted infinity field — world-space procedural dots replace the
          old line grid (hard intersections, zoom flicker, carpet edges).
          Scaled to match the infinite ground. */}
      <DottedGroundField w={w} h={h} />
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
  // mode prop retained for interface compat; MetaChipSet (its consumer) is
  // stripped under chrome austerity — the UnifiedPanel owns mode display.
  mode = "survey",
  siteMeta,
  northBearingDeg,
  levels = [],
  placements = [],
  features = [],
  annotationDialect = "technical",
  annotationLayers,
  tradePacks = {
    irrigationDrainage: false,
    hardscapeConstruction: false,
    lightingElectrical: false,
  },
  constructionTrenches = [],
  irrigationZones = [],
}: StudioSceneProps) {
  // Default policy keeps every mode's legacy behaviour when unset.
  const policy: CanvasLayerPolicy = layerPolicy ?? {
    subsurface: false,
    utilities: true,
    easements: true,
    groundAlbedo: "site",
  };
  // Subscribe to the view blend target — drives the editing-lock for controls
  // (editing is disabled when the camera is in 3D perspective mode, and
  // re-enabled only at the exact elevation snap: φ=90° + facade normal).
  // The v2 ortho presets (AXO/SEC) render via the ortho crossfade at their
  // tilt, so they stay editable — the lock derives from the same projection
  // state the camera renders, not just the blend flag.
  const viewBlendTarget = useSeasonalStore((s) => s.viewBlendTarget);
  const elevationActive = useSeasonalStore((s) => s.elevationActive);
  const cameraPreset = useSeasonalStore((s) => s.cameraPreset);
  const orthoPreset = cameraPreset === "axo" || cameraPreset === "sec";

  // THE terrain field — one sampler, every spatial layer samples it (mesh,
  // semantic lines, aerial). Null on flat projects (no levels).
  const elevationSampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  // Ambient meta chip-set — derived from title/overlay/level records, never
  // invented (absent data → absent chips). Recomputed only when inputs change.
  // The A2-6 canopy chip recomputes with placements — the site's canopy
  // obligation is live from title hydrate through placed trees. The site
  // envelope chip (sun × season × wetness × slope) recomputes with overlays
  // and terrain — the growing conditions that pre-filter the planting palette.
  const siteEnvelope = useMemo(
    () =>
      buildStudioSiteEnvelope({
        lat,
        lng,
        overlays: keylessOverlays,
        heightmapPoints,
        scaleM,
        boardAspect,
      }),
    [lat, lng, keylessOverlays, heightmapPoints, scaleM, boardAspect],
  );
  // Scan choreography — the ordered category reveals the director animates
  // (boundary draws, structures extrude, services ant-path, terrain fades,
  // trees grow). Built from the SAME hydrated props the layers render, so
  // absent categories simply never appear (zero-mock law).
  const scanChoreography = useMemo(
    () =>
      buildScanChoreography({
        boundaryPts: boundaryPct.length,
        buildingCount: buildingPct && buildingPct.length >= 3 ? 1 : 0,
        neighbourCount: neighbourBuildings.length,
        easementCount: easementsPct.length,
        serviceLineCount: servicesPct.length,
        hasTerrain: heightmapPoints.length >= 3,
        contourRingCount: keylessOverlays.filter((o) => o.kind === "contour").length,
        treeCount: items.filter((i) => i.t === "canopy" || i.t === "feature" || i.t === "exist")
          .length,
      }),
    [boundaryPct, buildingPct, neighbourBuildings, easementsPct, servicesPct, heightmapPoints, keylessOverlays, items],
  );
  // Vicmap meta chip-set — the in-drawing site data the scan-reveal spec
  // asserts (meta-chip-a26-canopy) and the coverage ratchet measures as
  // world-anchored annotation. Re-wired: the austerity strip orphaned a
  // live spec contract (feature-reachability gate).
  const metaChips = useMemo(
    () =>
      buildMetaChips({
        boundary: boundaryPct,
        scaleM,
        boardAspect,
        titleRef: siteMeta?.titleRef,
        lga: siteMeta?.lga,
        lotAreaM2: siteMeta?.lotAreaM2,
        overlays: keylessOverlays,
        easementRingCount: easementsPct.length,
        heightmap: heightmapPoints,
        sunHours: siteMeta?.sunHours,
        canopy: buildCanopyCompliance({
          placements,
          boundary: boundaryPct,
          scaleM,
          boardAspect,
          lotAreaM2: siteMeta?.lotAreaM2,
        }),
        envelope: siteEnvelope,
      }),
    [boundaryPct, scaleM, boardAspect, siteMeta, keylessOverlays, easementsPct, heightmapPoints, placements, siteEnvelope],
  );

  return (
    <>
      {/* Scan-reveal director — writes per-stage 0→1 progress into the
          scanReveal singleton every frame (layers read it in their own
          useFrame; no React re-renders). */}
      <ScanRevealDirector choreography={scanChoreography} />
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
          drafting={policy.groundAlbedo === "paper"}
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
      {/* Phase 5: Cinematic Fly-Through — spline-based camera animation.
          Mounts after FusedCamera so its useFrame runs later and overrides
          the camera during playback. Self-gates on isPlayingFlythrough. */}
      <FlythroughRig />

      {/* Phase 8: Pedestrian Camera — 1.7m first-person walk-through.
          Mounts after FusedCamera + FlythroughRig so its useFrame runs last
          and overrides the camera when cameraPosture === 'PEDESTRIAN'. */}
      <PedestrianCamera sampler={elevationSampler} />

      {/* Input capture — invisible ground plane for raycasting.
          Editing is locked when the rendered projection is perspective
          (fused blend > 0.5). The v2 ortho presets (AXO, SEC) render via
          the ortho crossfade, so they stay editable — the lock re-enables
          only at the exact orthographic elevation snap (φ=90° + facade
          normal) for free-orbit 3D views. */}
      <StudioControls
        scaleM={scaleM}
        boardAspect={boardAspect}
        onGroundClick={onGroundClick}
        onCursorMove={onCursorMove}
        tiltLocked={viewBlendTarget > 0.5 && !elevationActive && !orthoPreset}
      />

      {/* Ground — real terrain mesh when spot levels exist, flat plane otherwise. */}
      {heightmapPoints.length > 0 ? (
        <TerrainMesh scaleM={scaleM} boardAspect={boardAspect} heightmapPoints={heightmapPoints} groundAlbedo={policy.groundAlbedo} />
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
      {/* Working-drawing dimension ring (boundary B… + building F…) and the
          owner of survey edge truth — key, bearing and distance in one chip.
          The full ring self-gates on dimsView; the boundary chips also light on
          `bearings` alone, because Survey needs metes-and-bounds without a
          working-drawing ring over a lot still being traced. */}
      <DimensionLayer
        boundaryPct={boundaryPct}
        buildingPct={buildingPct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        northBearingDeg={northBearingDeg}
        /* Survey edge truth follows the mode's annotation layers (the CAD
         * card's Bearings control) — it was hardcoded false, which unmounted
         * the boundary chips entirely when Dims toggled off instead of
         * keeping the metes-and-bounds chips the control promises. */
        showBearings={annotationLayers?.bearings ?? false}
      />
      {/* E2E-only: publish the projected boundary box for the coverage ratchet
          (folds to null in production — see BoundaryProjectionProbe). */}
      {BOUNDARY_PROBE_ENABLED ? (
        <BoundaryProjectionProbe
          boundaryPct={boundaryPct}
          scaleM={scaleM}
          boardAspect={boardAspect}
        />
      ) : null}
      {/* Vicmap meta chip-set — ambient satellite tags orbiting the
          boundary (site data in the drawing; re-wired after the
          austerity strip orphaned the scan-reveal spec contract). */}
      <MetaChipSet
        boundaryPct={boundaryPct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        mode={mode}
        chips={metaChips}
      />
      {/* Measure tape — armed tool, self-gates on measureActive. */}
      <MeasureTapeLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
      />
      {/* Precision drafting (Polyline / Area) — click-to-place vertices with
          the snap ladder; self-gates on draftSession so the pan law holds. */}
      <DraftShapeLayer
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
        boundaryPct={boundaryPct}
      />
      {/* Irrigation zones — armed tool; a drag closes a ring that commits as
          an IrrigationZone with live area + flow readout. */}
      <IrrigationZoneLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Asset placement — armed fan-out symbol, self-gates on armedSymbolId. */}
      <AssetPlaceLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Mature-canopy spacing guides — ephemeral preview over a live row /
          area drag and the selected placement. Never persisted. */}
      <PlantSpacingGuideLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Flora ring — ranked suggestions at a click (self-gates on the
          session; candidates derive from lat/lng + live sun + placements). */}
      {lat != null && lng != null ? (
        <FloraRingLayer
          scaleM={scaleM}
          boardAspect={boardAspect}
          lat={lat}
          lng={lng}
          envelope={siteEnvelope}
        />
      ) : null}
      {/* Spatial Sketching — anti-void ground shadow (subtle dark radial
          gradient at Y=0, anchors peripheral vision without heavy grids). */}
      <GroundShadow scaleM={scaleM} />
      {/* Horizon line -- thin scene-space ring, fades in with camera tilt. */}
      <HorizonLine scaleM={scaleM} boardAspect={boardAspect} />
      {/* Soft AO-style grounding — blurred contact shadows anchor geometry to the
          drawing surface, complementing the directional sun shadows. */}
      <GroundContactShadows scaleM={scaleM} boardAspect={boardAspect} />
      <OriginPeg sampler={elevationSampler} />
      <LotBoundary points={boundaryPct} scaleM={scaleM} boardAspect={boardAspect} sampler={elevationSampler} />
      {/* Legal setback lines — red dashed non-build zones on the ground plane
          (AI site-setup pipeline, Phase 7). Reads from the store directly. */}
      <SetbackBoundaryLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        sampler={elevationSampler}
      />
      <MarqueeBoxLayer scaleM={scaleM} boardAspect={boardAspect} />
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
      {/* Analytical suncast — plan-sun-cast shadow footprints for the
          building + placed canopies, swept by the Sun panel. The building
          cast needs a massing height (never invented); tree casts use the
          grown canopy dimensions and are always honest. */}
      <SuncastOverlay
        scaleM={scaleM}
        boardAspect={boardAspect}
        buildingPct={buildingPct}
        items={items}
        lat={lat}
        lng={lng}
        buildingHeightM={0}
        growthFactor={growthFactor}
      />
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
        heightmapPoints={heightmapPoints}
      />
      {/* Converted CAD linework — orphan LandscapeFeatures (ditch/path/wall/
          direct-converted beds). Mirrored polygons render via the placement
          meshes; this layer never double-draws. */}
      <FeatureLayer
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
      />
      {/* Sketch → CAD ghost proposals — ephemeral markers for the tidy review. */}
      <CadProposalLayer scaleM={scaleM} boardAspect={boardAspect} />
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
          lat={lat}
          lng={lng}
        />
      ) : null}
      {/* Stroke Transfer — projects a stroke from one canvas plane onto
          another via forward perspective projection. Self-gates on
          transferToolArmed in the store. */}
      <StrokeTransferLayer scaleM={scaleM} boardAspect={boardAspect} />
      {/* Stitch ε-snap highlights — pulsing dots at weld nodes when the
          drawing cursor / unwarped stroke endpoint enters the snap radius.
          Self-gates on sketch mode + proximity; the drawing layers push
          `stitchSnapNodes` + `stitchHoverPoint` into the store. */}
      <StitchSnapLayer />
      {/* Photo-trace elevation — the pinned site photo as a frozen camera
          frame (self-gates on photoTraceSession). Freehand ink raycasts onto
          the vertical plane; the camera flies to the photo's facade look. */}
      <PhotoTracePlane scaleM={scaleM} boardAspect={boardAspect} />
      {/* P1 spatial gizmo — TransformControls on the single selected
          placement (translate/rotate, boundary-clamped, one undo per drag).
          Self-gates on selection + gizmoMode. */}
      <PlacementGizmo
        scaleM={scaleM}
        boardAspect={boardAspect}
        heightmapPoints={heightmapPoints}
      />
      <AnnotationLayer
        boundaryPct={boundaryPct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        northBearingDeg={northBearingDeg}
        levels={levels}
        placements={placements}
        features={features}
        dialect={annotationDialect}
        toggles={
          annotationLayers ?? {
            enabled: false,
            elevations: false,
            plants: false,
            materials: false,
            callouts: false,
            scope: false,
          }
        }
      />
      <TradeAnnotationLayer
        boundaryPct={boundaryPct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        dialect={annotationDialect}
        packs={tradePacks}
        trenches={constructionTrenches}
        zones={irrigationZones}
        features={features}
        placements={placements}
      />
    </>
  );
}

/**
 * Gold Standard 2026 — placed item rendering (trees, regions, hedges, beds).
 *
 * Ports the CadPlanBoard item layer into Three.js geometry. Each StudioItem
 * renders based on its type, using the same foliage/material language as the
 * proven Growth Studio (multi-lobe canopy, deterministic species hue, tapered
 * trunk, real shadow casters):
 *   - Trees (canopy/feature/exist): tapered trunk + multi-lobe foliage mass + TPZ ring
 *   - Hedges/bushes: rounded box foliage masses
 *   - Regions (lawn/bed/paving/deck): filled shape mesh from outlinePct
 *   - Linear (frenchdrain): box geometry along a path
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §2.2
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Line, Instances, Instance } from "@react-three/drei";
import { PALETTE } from "../../../styles/colorTokens";
import {
  useSeasonalStore,
  winterFactor,
  autumnFactor,
} from "./seasonalStore";
import { useStudioStore } from "./studioStore";
import { layerScaleAlpha, viewScaleRatioForZoom } from "./layerPolicy";
import { pctToWorld, type PctPoint } from "./coordTransform";

/** Minimal StudioItem shape (the fields the renderer needs). */
export interface RenderItem {
  id: string;
  t:
    | "canopy"
    | "feature"
    | "paving"
    | "deck"
    | "lawn"
    | "hedge"
    | "bed"
    | "frenchdrain"
    | "exist"
    | "bollard";
  x: number;  // board-% position
  y: number;  // board-% position
  rot: number;
  scale: number;
  ghost: boolean;
  outlinePct?: PctPoint[];
  dbhM?: number;
  heightM?: number;
  /** Species leaf habit from the catalog symbol keywords — drives the winter
   *  canopy drop when declared; falls back to existing-vs-new planting. */
  leafRetention?: "deciduous" | "evergreen";
}

const SPECIES_TYPES = new Set(["canopy", "feature", "exist"]);
const REGION_TYPES = new Set(["lawn", "bed", "paving", "deck"]);

/** Gold Standard base hues for foliage, per planting family. Light-theme
 *  (l-*) ramp values from the token palette — the dark-era d-* ramp read as
 *  murk on the paper canvas and was retired with the Studio Paper pivot. */
const FOLIAGE = {
  canopy: PALETTE.forestL600,   // forest l-600
  feature: PALETTE.sproutL500,  // sprout l-500
  exist: PALETTE.forestL600,    // retained forest
  hedge: PALETTE.hedgeL600,     // hedge l-600
  bed: PALETTE.sproutL500,
  lawn: PALETTE.lawnL100,       // light lawn on paper
  paving: PALETTE.bluestoneL400, // bluestone l-400
  deck: PALETTE.timberL400,     // timber l-400
  frenchdrain: PALETTE.waterL500, // water l-500
  ghost: "#6b7078",        // muted
  trunk: "#4a3d2e",        // bark
  bollard: PALETTE.anodizedMetal, // anodized fallback (BollardLight handles its own)
};

/** Seasonal foliage color anchors — THREE.Color instances for lerpColors in
 *  useFrame (LA Seasonal Dynamics Rule 3). Summer green → autumn orange. */
const SUMMER_GREEN = new THREE.Color(PALETTE.summerGreen);
const AUTUMN_ORANGE = new THREE.Color(PALETTE.autumnOrange);

/** Multi-lobe offsets that give a canopy its organic, clustered-foliage mass.
 *  Expanded from GrowthStudioClient's 4-lobe rig to 6 lobes with more
 *  asymmetry + a raised crown tier [x, y, z, scale, lightShift]. */
const CANOPY_LOBES: Array<[number, number, number, number, number]> = [
  [0, 0, 0, 1.0, 0],          // centre, full scale
  [0.34, 0.06, 0.2, 0.7, 3],  // +X, slight up, +Z, lighter
  [-0.3, -0.03, -0.22, 0.66, -2], // -X, slight down, -Z, darker
  [0.06, 0.2, -0.3, 0.6, 4],  // near +X, up, -Z, lighter
  [-0.18, 0.14, 0.26, 0.56, -3], // -X, up, +Z, darker
  [0.22, -0.12, -0.1, 0.5, 2], // +X, down, -Z, lighter
];

/** Upper crown tier — smaller lobes raised above the main mass for crown depth. */
const CROWN_LOBES: Array<[number, number, number, number, number]> = [
  [0, 0.42, 0, 0.42, 6],
  [0.16, 0.36, 0.1, 0.32, 4],
  [-0.12, 0.34, -0.08, 0.3, -2],
];

/** TPZ ring (AS 4970 protection zone) for existing trees. */
function TpzRing({
  position,
  radiusM,
  color,
}: {
  position: [number, number, number];
  radiusM: number;
  color: string;
}) {
  const points = useMemo(() => {
    const segs = 64;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([
        position[0] + Math.cos(a) * radiusM,
        position[1],
        position[2] + Math.sin(a) * radiusM,
      ]);
    }
    return pts;
  }, [position, radiusM]);

  return (
    <Line points={points} color={color} lineWidth={1} dashed dashSize={0.3} gapSize={0.2} />
  );
}

/** Resolve a foliage colour for a tree: deterministic HSL tint around the base
 *  family hue, so individuals read as distinct specimens, not clones. Existing
 *  trees get a deeper, more saturated read (mature canopy). An optional
 *  lightShift jogs the lightness per-lobe so the canopy isn't one flat colour. */
function foliageColor(
  t: RenderItem["t"],
  _seed: string,
  ghost: boolean,
  lightShift = 0,
): string {
  if (ghost) return FOLIAGE.ghost;
  const hue = t === "exist" ? 132 : 125;
  const sat = t === "exist" ? 26 : 42;
  const baseLight = t === "exist" ? 30 : 34;
  const light = Math.max(12, Math.min(55, baseLight + lightShift));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** A single canopy lobe — smooth-shaded icosahedron (GrowthStudio uses smooth,
 *  NOT flatShading — the low-poly faceting comes from geometry detail level). */
function CanopyLobe({
  position,
  scale,
  radiusM,
  color,
  opacity,
}: {
  position: [number, number, number];
  scale: number;
  radiusM: number;
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <icosahedronGeometry args={[radiusM, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.78}
        metalness={0.04}
      />
    </mesh>
  );
}

/**
 * Multi-lobe canopy cluster — the organic foliage mass that reads as a real
 * tree, not a plastic ball. 6 asymmetric main lobes + 3 raised crown lobes,
 * each with a deterministic per-lobe lightness jitter so the canopy has
 * internal colour variation (lit top, shaded underside). Smooth shading —
 * the GrowthStudio reference deliberately does NOT use flatShading.
 *
 * Seasonal mutation (Rule 3): a useFrame loop traverses the group's children
 * and lerps lobe material colours toward autumn orange — DECIDUOUS species
 * only (species truth via the catalog keywords; evergreens hold their green,
 * which is what keeps a Melbourne garden reading green through April).
 * Winter drops opacity toward bare. Zero React re-renders — reads via
 * getState(). Ghost canopies skip the seasonal lerp (they're muted already).
 */
function CanopyCluster({
  radiusM,
  seed,
  ghost,
  leafRetention,
}: {
  radiusM: number;
  seed: string;
  ghost: boolean;
  leafRetention?: "deciduous" | "evergreen";
}) {
  const groupRef = useRef<THREE.Group>(null);
  const opacity = ghost ? 0.38 : 0.92;

  // Cache per-lobe base colors so the seasonal lerp starts from the right tint.
  const baseColors = useMemo(() => {
    const colors: THREE.Color[] = [];
    for (const [, , , , ls] of CANOPY_LOBES) {
      colors.push(new THREE.Color(foliageColor("canopy", seed + ls, false, ls)));
    }
    for (const [, , , , ls] of CROWN_LOBES) {
      colors.push(new THREE.Color(foliageColor("canopy", seed + "c" + ls, false, ls)));
    }
    return colors;
  }, [seed]);

  useFrame(() => {
    if (ghost || !groupRef.current) return;
    const { seasonProgress } = useSeasonalStore.getState();
    // plantSymbol scale-band visibility — the seasonal loop owns canopy
    // opacity, so it consumes the cross-fade alpha here (the SceneItems veil
    // skips materials flagged seasonalOpacity).
    const alpha = layerScaleAlpha(
      "plantSymbol",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    // Species truth: only deciduous canopies lerp toward autumn orange.
    const aFactor =
      leafRetention === "evergreen" ? 0 : autumnFactor(seasonProgress);
    const wFactor =
      leafRetention === "evergreen" ? 0 : winterFactor(seasonProgress);
    // Winter opacity drop: full → bare (0.1 keeps a faint silhouette).
    const seasonalOpacity =
      leafRetention === "evergreen"
        ? opacity * (1 - 0.1 * winterFactor(seasonProgress))
        : opacity * (1 - wFactor * 0.85);

    let ci = 0;
    groupRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!mat || !mat.color) return;
      // This material's opacity is written absolutely every frame — tell the
      // SceneItems scale veil to skip it (it consumes alpha right here).
      mat.userData.seasonalOpacity = true;
      // Lerp from the lobe's base summer tint toward autumn orange.
      const base = baseColors[ci] ?? SUMMER_GREEN;
      mat.color.lerpColors(base, AUTUMN_ORANGE, aFactor);
      mat.opacity = seasonalOpacity * alpha;
      ci += 1;
    });
  });

  return (
    <group ref={groupRef}>
      {CANOPY_LOBES.map(([ox, oy, oz, s, ls], i) => (
        <CanopyLobe
          key={`main-${i}`}
          position={[ox * radiusM, oy * radiusM, oz * radiusM]}
          scale={s}
          radiusM={radiusM}
          color={ghost ? FOLIAGE.ghost : foliageColor("canopy", seed + i, false, ls)}
          opacity={opacity}
        />
      ))}
      {CROWN_LOBES.map(([ox, oy, oz, s, ls], i) => (
        <CanopyLobe
          key={`crown-${i}`}
          position={[ox * radiusM, oy * radiusM, oz * radiusM]}
          scale={s}
          radiusM={radiusM}
          color={ghost ? FOLIAGE.ghost : foliageColor("canopy", seed + "c" + i, false, ls)}
          opacity={opacity}
        />
      ))}
    </group>
  );
}

/** A tree: tapered trunk + multi-lobe canopy + optional TPZ ring.
 *  Growth-aware (growthFactor prop) + season-aware (winter canopy drop via
 *  useFrame mutation — LA Seasonal Dynamics Rule 2 multiplier rule). */
function TreeMesh({
  item,
  scaleM,
  boardAspect,
  hideTpz = false,
  growthFactor = 1,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
  hideTpz?: boolean;
  growthFactor?: number;
}) {
  const canopyScaleRef = useRef<THREE.Group>(null);
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const isExist = item.t === "exist";
  const { heightM, canopyM } = grownDimensions(item, growthFactor);
  const canopyRadius = (canopyM * item.scale) / 2;
  const trunkHeight = heightM * 0.42;
  const canopyY = trunkHeight + canopyRadius * 0.7;

  const tpzRadiusM = useMemo(() => {
    if (!isExist || !item.dbhM) return 0;
    // AS 4970: TPZ radius = 12 × DBH, clamped 2–15m
    return Math.min(Math.max(item.dbhM * 12, 2), 15);
  }, [isExist, item.dbhM]);

  const trunkTopR = Math.max(0.04, canopyRadius * 0.05);
  const trunkBotR = Math.max(0.06, canopyRadius * 0.08);

  // Rule 2 — winter canopy drop multiplier: finalScale = growthScale * lerp(1, 0, winter).
  // Species truth first: evergreen symbols hold 70% of their canopy in winter,
  // deciduous symbols go bare. Without a declared habit, fall back to the
  // existing-vs-new heuristic (retained trees read mature/evergreen).
  // Trunk + branches stay full-size (bare winter read).
  useFrame(() => {
    const grp = canopyScaleRef.current;
    if (!grp) return;
    const { seasonProgress } = useSeasonalStore.getState();
    const wFactor = winterFactor(seasonProgress);
    const retention =
      item.leafRetention === "evergreen"
        ? 0.7
        : item.leafRetention === "deciduous"
          ? 0.05
          : isExist
            ? 0.7
            : 0.05;
    grp.scale.setScalar(1 - wFactor * (1 - retention));
  });

  return (
    <group position={[wx, 0, wz]} rotation={[0, (item.rot * Math.PI) / 180, 0]}>
      {/* Trunk — tapered cylinder, matte bark (proven GrowthStudio material) */}
      <mesh position={[0, trunkHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[trunkTopR, trunkBotR, trunkHeight, 8]} />
        <meshStandardMaterial color={PALETTE.bark} roughness={0.95} metalness={0} />
      </mesh>
      {/* Canopy — multi-lobe foliage mass. Scale mutated per-frame for winter drop. */}
      <group ref={canopyScaleRef} position={[0, canopyY, 0]}>
        <CanopyCluster
          radiusM={canopyRadius}
          seed={item.id}
          ghost={item.ghost}
          leafRetention={item.leafRetention}
        />
      </group>
      {/* TPZ ring (existing trees only, hidden in Presentation Lens).
          Roots/TPZ ignore season entirely — governed only by growthYear (Rule 2). */}
      {tpzRadiusM > 0 && !hideTpz && (
        <TpzRing position={[0, 0.02, 0]} radiusM={tpzRadiusM} color={FOLIAGE.exist} />
      )}
    </group>
  );
}

/** A hedge or bush — rounded box foliage masses clustered along the item
 *  footprint. Reads as a clipped hedge / shrub mass, distinct from a tree. */
function HedgeMesh({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const heightM = (item.heightM ?? 1.4) * item.scale;
  const lengthM = 2.2 * item.scale;
  const color = item.ghost ? FOLIAGE.ghost : FOLIAGE.hedge;

  // Cluster of rounded lobes along the hedge length for a leafy top profile.
  const lobes = useMemo<Array<[number, number, number, number]>>(() => {
    const n = 3;
    const out: Array<[number, number, number, number]> = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out.push([(t - 0.5) * lengthM, 0, 0, 0.6 + (i % 2) * 0.15]);
    }
    return out;
  }, [lengthM]);

  return (
    <group position={[wx, 0, wz]} rotation={[0, (item.rot * Math.PI) / 180, 0]}>
      {/* Base box — the clipped hedge body */}
      <mesh position={[0, heightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lengthM, heightM, heightM * 0.7]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={item.ghost ? 0.3 : 0.88}
          roughness={0.82}
          metalness={0.03}
          flatShading
        />
      </mesh>
      {/* Leafy top lobes — softens the box into a foliage mass */}
      {lobes.map(([ox, oy, oz, s], i) => (
        <mesh
          key={i}
          position={[ox, heightM + oy, oz]}
          scale={s}
          castShadow
          receiveShadow
        >
          <icosahedronGeometry args={[heightM * 0.55, 1]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={item.ghost ? 0.28 : 0.85}
            roughness={0.8}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * LA Hardscape — PavingMesh.
 *
 * Rule 1 (The Bevel Rule): ExtrudeGeometry from THREE.Shape, never flat planes.
 * Mandatory micro-bevel catches IBL sky specular + rim light so the paving reads
 * as poured/cut stone, not a cheap CG card.
 * Rule 3: Architectural concrete PBR — color #8c9294, roughness 0.65, metalness 0.15.
 * Rule 5: castShadow + receiveShadow for VSMShadowMap.
 */
function PavingMesh({
  outlinePct,
  scaleM,
  boardAspect,
  ghost,
}: {
  outlinePct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  ghost: boolean;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const geo = useMemo(() => {
    if (!outlinePct || outlinePct.length < 3) return null;
    const shape = new THREE.Shape();
    const world = outlinePct.map((p) => pctToWorld(p, scaleM, boardAspect));
    shape.moveTo(world[0][0], world[0][1]);
    for (let i = 1; i < world.length; i++) shape.lineTo(world[i][0], world[i][1]);
    shape.closePath();
    // Rule 1 — mandatory bevel. depth = slab thickness (10cm), micro-bevels
    // on the top + bottom edges catch the environment specular.
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
  }, [outlinePct, scaleM, boardAspect]);

  // Rule 3 — hardscape moisture: drop roughness 0.65 → 0.2 in winter so the
  // concrete reads as wet and highly reflective of the dark sky.
  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const { seasonProgress } = useSeasonalStore.getState();
    const wFactor = winterFactor(seasonProgress);
    mat.roughness = 0.65 - wFactor * 0.45; // 0.65 (dry) → 0.2 (wet)
  });

  if (!geo) return null;
  return (
    <group>
      <mesh
        geometry={geo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={matRef}
          color={ghost ? FOLIAGE.ghost : PALETTE.concrete}
          transparent={ghost}
          opacity={ghost ? 0.4 : 1}
          roughness={0.65}
          metalness={0.15}
          dithering
        />
      </mesh>
    </group>
  );
}

/**
 * LA Hardscape — DeckMesh.
 *
 * Rule 2 (Physical Gap Occlusion): individual planks via drei <Instances> with
 * a real 0.02m (2cm) gap between each. Physical gaps force the N8AO pass to
 * calculate deep micro-shadows between planks — massive physical weight.
 * Rule 3: Weathered timber PBR — color #5c4a3d, roughness 0.85, metalness 0.
 */
function DeckMesh({
  outlinePct,
  scaleM,
  boardAspect,
  ghost,
}: {
  outlinePct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  ghost: boolean;
}) {
  // Compute the deck's bounding box from its outline, then lay planks across
  // the width with 2cm gaps between each instance.
  const { planks, origin } = useMemo(() => {
    if (!outlinePct || outlinePct.length < 3) {
      return { planks: [] as Array<[number, number]>, origin: [0, 0] as [number, number] };
    }
    const world = outlinePct.map((p) => pctToWorld(p, scaleM, boardAspect));
    const xs = world.map((p) => p[0]);
    const zs = world.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const widthM = maxX - minX;
    const depthM = maxZ - minZ;
    const plankWidth = 0.14; // 140mm typical decking plank
    const gap = 0.02;        // Rule 2: 2cm physical gap
    const stride = plankWidth + gap;
    const count = Math.max(1, Math.floor((widthM + gap) / stride));
    const centres: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const cx = minX + stride / 2 + i * stride;
      centres.push([cx, depthM]);
    }
    return { planks: centres, origin: [minX, minZ] as [number, number] };
  }, [outlinePct, scaleM, boardAspect]);

  if (planks.length === 0) return null;
  const [ox] = origin;
  const plankDepth = planks[0]?.[1] ?? 1;
  const plankHeight = 0.04; // 40mm sleeper thickness

  return (
    <group position={[0, 0.04, 0]}>
      <Instances limit={planks.length} castShadow receiveShadow>
        <boxGeometry args={[0.14, plankHeight, plankDepth]} />
        <meshStandardMaterial
          color={ghost ? FOLIAGE.ghost : PALETTE.timberWeathered}
          transparent={ghost}
          opacity={ghost ? 0.4 : 1}
          roughness={0.85}
          metalness={0}
          dithering
        />
        {planks.map(([cx, _depth], i) => (
          <Instance
            key={i}
            position={[cx - ox, 0, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}

/**
 * LA Hardscape — BollardLight fixture.
 *
 * Rule 4 (Bloom Integration): the light-emitting cap uses emissive #ffeedd at
 * emissiveIntensity 2.5, with toneMapped={false} so ACESFilmic doesn't crush
 * the glow before the Bloom pass reads it.
 * Rule 3: Dark anodized metal body — color #2a2d30, roughness 0.3, metalness 0.85
 * (relies almost entirely on the environment map for its shape).
 */
function BollardLight({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const height = (item.heightM ?? 0.9) * item.scale;
  const bodyR = 0.05 * item.scale;
  const capR = 0.07 * item.scale;
  const ghost = item.ghost;

  return (
    <group position={[wx, 0, wz]} rotation={[0, (item.rot * Math.PI) / 180, 0]}>
      {/* Anodized metal body — cylinder, relies on env map for its shape */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[bodyR, bodyR * 1.2, height, 12]} />
        <meshStandardMaterial
          color={ghost ? FOLIAGE.ghost : PALETTE.anodizedMetal}
          transparent={ghost}
          opacity={ghost ? 0.4 : 1}
          roughness={0.3}
          metalness={0.85}
          dithering
        />
      </mesh>
      {/* LED cap — emissive, toneMapped={false} so Bloom reads the glow.
          Not transparent when ghosting (the light itself should read). */}
      <mesh position={[0, height + capR * 0.3, 0]} castShadow>
        <cylinderGeometry args={[capR, capR, capR * 0.5, 16]} />
        <meshStandardMaterial
          color={PALETTE.ledWarm}
          emissive={PALETTE.ledWarm}
          emissiveIntensity={2.5}
          toneMapped={false}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** A region polygon (lawn/bed) from outlinePct. Paving + deck dispatch to
 *  their dedicated hardscape meshes (PavingMesh / DeckMesh). */
function RegionMesh({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
  // Lawn + bed only. Paving + deck dispatch to PavingMesh/DeckMesh from the
  // SceneItem dispatcher (before this component is reached).
  const shape = useMemo(() => {
    if (!item.outlinePct || item.outlinePct.length < 3) return null;
    const shape = new THREE.Shape();
    const world = item.outlinePct.map((p) => pctToWorld(p, scaleM, boardAspect));
    shape.moveTo(world[0][0], world[0][1]);
    for (let i = 1; i < world.length; i++) shape.lineTo(world[i][0], world[i][1]);
    shape.closePath();
    return shape;
  }, [item.outlinePct, scaleM, boardAspect]);

  if (!shape) return null;

  const isLawn = item.t === "lawn";
  const isBed = item.t === "bed";
  const color = item.ghost ? FOLIAGE.ghost : FOLIAGE[item.t] ?? FOLIAGE.lawn;
  // Lawn reads as turf (flatter, slightly raised); beds as mulch/soil (darker).
  const opacity = item.ghost ? 0.22 : isLawn ? 0.55 : 0.5;
  const yLift = isLawn ? 0.04 : isBed ? 0.03 : 0.02;

  return (
    <mesh position={[0, yLift, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.95}
        metalness={0}
        side={THREE.DoubleSide}
        dithering
      />
    </mesh>
  );
}

/**
 * Resolve the effective height/canopy for a tree given a growth factor.
 * 0 = just planted (20% of mature size), 1 = 10-year maturity (100%).
 * Existing trees are always at maturity (they're already grown).
 *
 * This mirrors the domain package's resolveItemHeightGrownM logic but
 * applied in the renderer for smooth 3D animation.
 */
function grownDimensions(
  item: RenderItem,
  growthFactor: number,
): { heightM: number; canopyM: number } {
  const isExist = item.t === "exist";
  const baseHeight = item.heightM ?? (item.t === "canopy" ? 6 : isExist ? 8 : 4);
  const baseCanopy = item.t === "canopy" ? 6 : isExist ? 7 : 4;
  // Existing trees are already mature — growth factor doesn't apply
  if (isExist) return { heightM: baseHeight, canopyM: baseCanopy };
  // New plantings: interpolate from 20% at planting to 100% at maturity
  const factor = 0.2 + growthFactor * 0.8;
  return { heightM: baseHeight * factor, canopyM: baseCanopy * factor };
}

/**
 * Render a placed item. Dispatches by type.
 */
export function SceneItem({
  item,
  scaleM,
  boardAspect,
  hideTpz = false,
  growthFactor = 1,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
  hideTpz?: boolean;
  growthFactor?: number;
}) {
  if (SPECIES_TYPES.has(item.t)) {
    return (
      <TreeMesh
        item={item}
        scaleM={scaleM}
        boardAspect={boardAspect}
        hideTpz={hideTpz}
        growthFactor={growthFactor}
      />
    );
  }
  if (item.t === "hedge") {
    return <HedgeMesh item={item} scaleM={scaleM} boardAspect={boardAspect} />;
  }
  // Hardscape (LA Specification): paving + deck build beveled/extruded geometry
  // with physical gaps; bollard is a light fixture. All react to IBL + VSM +
  // N8AO + Bloom per the brief.
  if (item.t === "paving" && item.outlinePct) {
    return (
      <PavingMesh
        outlinePct={item.outlinePct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        ghost={item.ghost}
      />
    );
  }
  if (item.t === "deck" && item.outlinePct) {
    return (
      <DeckMesh
        outlinePct={item.outlinePct}
        scaleM={scaleM}
        boardAspect={boardAspect}
        ghost={item.ghost}
      />
    );
  }
  if (item.t === "bollard") {
    return <BollardLight item={item} scaleM={scaleM} boardAspect={boardAspect} />;
  }
  // Lawn + bed remain flat shape regions
  if (REGION_TYPES.has(item.t) && item.outlinePct) {
    return <RegionMesh item={item} scaleM={scaleM} boardAspect={boardAspect} />;
  }
  // frenchdrain and region-less items: simple flat disc
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const color = item.ghost ? FOLIAGE.ghost : FOLIAGE[item.t] ?? FOLIAGE.lawn;
  const radius = 0.5 * item.scale;
  return (
    <mesh position={[wx, 0.01, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.9} />
    </mesh>
  );
}

/**
 * Render all items.
 *
 * plantSymbol scale-band visibility: a per-frame veil over the group's
 * transparent materials cross-fades the placement graphics out at macro
 * zoom (band [0.3, 3.5] × fit). Materials whose opacity is written
 * absolutely each frame by a seasonal loop are flagged `seasonalOpacity`
 * and consume the alpha themselves; everything else static (regions, hedge
 * lobes, ghost graphics) is base-captured here. Opaque solids (trunks,
 * paving/deck masses) are deliberately skipped — they read as site truth
 * surfaces and stay visible, like the siteFrame band.
 */
export function SceneItems({
  items,
  scaleM,
  boardAspect,
  hideTpz = false,
  growthFactor = 1,
}: {
  items: RenderItem[];
  scaleM: number;
  boardAspect: number;
  hideTpz?: boolean;
  growthFactor?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;
    const alpha = layerScaleAlpha(
      "plantSymbol",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    grp.traverse((obj) => {
      const mat = (obj as THREE.Mesh)
        .material as THREE.MeshStandardMaterial | undefined;
      if (!mat || !mat.transparent || mat.userData.seasonalOpacity) return;
      const base = mat.userData.scaleVeilBase as number | undefined;
      if (base === undefined) mat.userData.scaleVeilBase = mat.opacity;
      mat.opacity = (mat.userData.scaleVeilBase as number) * alpha;
    });
  });

  return (
    <group ref={groupRef}>
      {items.map((item) => (
        <SceneItem
          key={item.id}
          item={item}
          scaleM={scaleM}
          boardAspect={boardAspect}
          hideTpz={hideTpz}
          growthFactor={growthFactor}
        />
      ))}
    </group>
  );
}

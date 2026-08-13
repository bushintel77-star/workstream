/**
 * Gold Standard 2026 — placed item rendering (trees, regions, hardscape).
 *
 * Ports the CadPlanBoard item layer into Three.js geometry. Each StudioItem
 * renders based on its type:
 *   - Trees (canopy/feature/exist): trunk cylinder + canopy sphere + TPZ ring
 *   - Regions (lawn/bed/paving/deck): filled shape mesh from outlinePct
 *   - Linear (hedge/frenchdrain): box geometry along a path
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §2.2
 */

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { pctToWorld, type PctPoint } from "./coordTransform";

/** Minimal StudioItem shape (the fields the renderer needs). */
export interface RenderItem {
  id: string;
  t: "canopy" | "feature" | "paving" | "deck" | "lawn" | "hedge" | "bed" | "frenchdrain" | "exist";
  x: number;  // board-% position
  y: number;  // board-% position
  rot: number;
  scale: number;
  ghost: boolean;
  outlinePct?: PctPoint[];
  dbhM?: number;
  heightM?: number;
}

const SPECIES_TYPES = new Set(["canopy", "feature", "exist"]);
const REGION_TYPES = new Set(["lawn", "bed", "paving", "deck"]);

/** Gold Standard signal colors for Three.js materials. */
const COLORS = {
  canopy: "#4c9662",       // forest
  feature: "#5ca871",      // sprout
  exist: "#328052",        // retained
  hedge: "#4c7d5c",
  bed: "#5ca871",
  lawn: "#328052",
  paving: "#8b96a0",       // bluestone
  deck: "#c89968",         // timber
  frenchdrain: "#2e86ab",  // water
  ghost: "#6b7078",        // muted
};

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

/** A tree: trunk + canopy + optional TPZ ring. */
function TreeMesh({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const isExist = item.t === "exist";
  const heightM = item.heightM ?? (item.t === "canopy" ? 6 : item.t === "exist" ? 8 : 4);
  const canopyM = item.t === "canopy" ? 6 : item.t === "exist" ? 7 : 4;
  const canopyRadius = (canopyM * item.scale) / 2;
  const trunkHeight = heightM * 0.4;
  const canopyY = trunkHeight + canopyRadius * 0.6;
  const color = item.ghost ? COLORS.ghost : COLORS[item.t] ?? COLORS.canopy;
  const opacity = item.ghost ? 0.4 : 0.75;

  const tpzRadiusM = useMemo(() => {
    if (!isExist || !item.dbhM) return 0;
    // AS 4970: TPZ radius = 12 × DBH, clamped 2–15m
    return Math.min(Math.max(item.dbhM * 12, 2), 15);
  }, [isExist, item.dbhM]);

  return (
    <group position={[wx, 0, wz]} rotation={[0, (item.rot * Math.PI) / 180, 0]}>
      {/* Trunk */}
      <mesh position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[0.1 * item.scale, 0.15 * item.scale, trunkHeight, 8]} />
        <meshStandardMaterial color="#2a3037" roughness={0.9} />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, canopyY, 0]}>
        <sphereGeometry args={[canopyRadius, 24, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.8}
        />
      </mesh>
      {/* TPZ ring (existing trees only) */}
      {tpzRadiusM > 0 && (
        <TpzRing position={[0, 0.02, 0]} radiusM={tpzRadiusM} color={COLORS.exist} />
      )}
    </group>
  );
}

/** A region polygon (lawn/bed/paving/deck) from outlinePct. */
function RegionMesh({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
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

  const color = item.ghost ? COLORS.ghost : COLORS[item.t] ?? COLORS.lawn;
  const opacity = item.ghost ? 0.25 : 0.35;

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Render a placed item. Dispatches by type.
 */
export function SceneItem({
  item,
  scaleM,
  boardAspect,
}: {
  item: RenderItem;
  scaleM: number;
  boardAspect: number;
}) {
  if (SPECIES_TYPES.has(item.t)) {
    return <TreeMesh item={item} scaleM={scaleM} boardAspect={boardAspect} />;
  }
  if (REGION_TYPES.has(item.t) && item.outlinePct) {
    return <RegionMesh item={item} scaleM={scaleM} boardAspect={boardAspect} />;
  }
  // Hedge, frenchdrain, and region-less items: simple flat disc
  const [wx, wz] = pctToWorld(item, scaleM, boardAspect);
  const color = item.ghost ? COLORS.ghost : COLORS[item.t] ?? COLORS.lawn;
  const radius = 0.5 * item.scale;
  return (
    <mesh position={[wx, 0.01, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.3} roughness={0.9} />
    </mesh>
  );
}

/**
 * Render all items.
 */
export function SceneItems({
  items,
  scaleM,
  boardAspect,
}: {
  items: RenderItem[];
  scaleM: number;
  boardAspect: number;
}) {
  return (
    <>
      {items.map((item) => (
        <SceneItem key={item.id} item={item} scaleM={scaleM} boardAspect={boardAspect} />
      ))}
    </>
  );
}

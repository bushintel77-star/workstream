/**
 * Gold Standard 2026 — Subsurface Engine + Strike Alert renderer.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2
 *
 * Underground utilities render as a **hairline CAD schematic** — not physical
 * PVC pipes. Drei <Line> (Line2/LineMaterial) draws screen-space-constant 2px
 * vectors in muted drafting colours, with an agonizingly slow dashOffset flow
 * that communicates directionality without distracting the eye. depthTest is
 * disabled so the lines show through the vellum ground plane in blueprint mode.
 *
 * Strike Alerts remain physical (emissive PBR spheres + Billboard text) — they
 * are alerts, not data, so they carry visual weight via the Bloom pass.
 *
 * Lives inside the R3F <Canvas> (Layer 2). CAD line colours are sourced from
 * the PALETTE mirror of the --gs-cad-* render tokens (gate-clean).
 */

import { useMemo, useRef, type ElementRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { LayerID, UtilityType } from "@workstream/domain";
import { useReducedMotion } from "../useReducedMotion";
import { PALETTE } from "../../../../styles/colorTokens";
import { useSeasonalStore } from "../seasonalStore";

/** Muted drafting CAD colours (NOT neon). Reads as engineering vellum. */
const UTILITY_COLORS: Record<UtilityType, string> = {
  water: PALETTE.cadWater,
  sewer: PALETTE.cadSewer,
  gas: PALETTE.cadGas,
  electric: PALETTE.cadElectric,
  comms: PALETTE.cadComms,
  reclaimed: PALETTE.cadReclaimed,
};

/** Flow animation speeds (world units / second). Agonizingly slow — the eye
 *  tracks direction only if the user stares. Electric/data fast; drainage slow. */
const FLOW_SPEEDS: Record<UtilityType, number> = {
  electric: 0.15,
  comms: 0.15,
  water: 0.08,
  gas: 0.08,
  reclaimed: 0.08,
  sewer: 0.03,
};

export interface SubsurfaceUtility {
  id: string;
  type: UtilityType;
  start: [number, number]; // metre-space [x, z]
  end: [number, number]; // metre-space [x, z]
  depthM: number;
  toleranceM: number;
  depthSource: "assumed" | "measured";
  source: "byda" | "traced" | "assumed";
}

export interface StrikeAlertData {
  id: string;
  /** Present for utility strikes; layer strikes carry layerId instead. */
  utilityType?: UtilityType;
  /** Registry layer that owns a layer strike (e.g. vicmap.easement). */
  layerId?: LayerID;
  /** The hazard's feature id (utility id or easement ring-edge id). */
  hazardId?: string;
  /** The excavation (trench) that caused the strike. */
  excavationId?: string;
  point: [number, number, number]; // [x, y(=depth), z]
  severity: "direct" | "near" | "proximity";
  /**
   * Locating tolerance of the hazard this strike is against (m). Spec §11a
   * requires the conflict card to state it — a strike measured against an
   * assumed depth with a 0.5m tolerance is a different fact from one against
   * a located service, and the card must not hide the difference.
   */
  toleranceM?: number;
  /** Whether the hazard's depth was measured or assumed. */
  depthSource?: "assumed" | "measured";
}

/**
 * Schematic conduit — a hairline CAD line representing an underground utility.
 *
 * Replaces the old TubeGeometry + meshStandardMaterial (which read as a
 * plastic pipe). Uses drei <Line> (Line2/LineMaterial) for screen-space-
 * constant 2px width regardless of ortho zoom. The dashOffset creeps slowly
 * to show flow direction. depthTest={false} + renderOrder=1 so the line
 * renders crisply on top of the vellum ground in blueprint mode.
 *
 * The conduit is only visible when subsurfaceView is toggled on (drops from
 * the render loop entirely when off — zero draw-call cost).
 */
function SchematicConduit({ util }: { util: SubsurfaceUtility }) {
  const reducedMotion = useReducedMotion();
  // drei <Line> forwards a Line2 whose .material is a LineMaterial with a
  // mutable dashOffset. ElementRef<typeof Line> resolves to Line2 | LineSegments2
  // without needing to import three-stdlib directly.
  const lineRef = useRef<ElementRef<typeof Line>>(null);
  const color = UTILITY_COLORS[util.type] ?? PALETTE.cadWater;
  const flowSpeed = FLOW_SPEEDS[util.type] ?? 0.05;

  // Build the 2-point path at the utility's burial depth (y negative = below
  // ground plane). Slightly raised (-depthM + 0.008) to avoid z-fighting with
  // the ground surface in non-blueprint mode.
  const points = useMemo<[number, number, number][]>(
    () => [
      [util.start[0], -util.depthM + 0.008, util.start[1]],
      [util.end[0], -util.depthM + 0.008, util.end[1]],
    ],
    [util.start, util.end, util.depthM],
  );

  // Micro-animation — creep the dashOffset. Barely perceptible.
  useFrame((_, delta) => {
    const line = lineRef.current;
    if (!line || reducedMotion) return;
    line.material.dashOffset -= delta * flowSpeed;
  });

  return (
    <>
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.5}
        gapSize={0.35}
        depthTest={false}
        renderOrder={1}
        transparent
        opacity={0.9}
      />
      <Billboard
        position={[
          (util.start[0] + util.end[0]) / 2,
          -util.depthM + 0.2,
          (util.start[1] + util.end[1]) / 2,
        ]}
      >
        <Text
          fontSize={0.28}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.015}
          outlineColor={PALETTE.gsCanvas}
        >
          {`${util.type.toUpperCase()} · ${util.depthSource.toUpperCase()} ${util.depthM.toFixed(2)}m`}
        </Text>
      </Billboard>
    </>
  );
}

/** Strike alert — an emissive pulsing sphere at a collision point. Physical
 *  (PBR + emissive) so it carries visual weight via the Bloom pass. The
 *  toneMapped={false} flag bypasses ACES so the glow isn't crushed. */
function StrikePulse({ alert }: { alert: StrikeAlertData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const reducedMotion = useReducedMotion();

  useFrame((state) => {
    if (reducedMotion) {
      meshRef.current?.scale.setScalar(1);
      glowRef.current?.scale.setScalar(1);
      return;
    }
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      const pulse = 1 + Math.sin(t * 4) * 0.15;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      const pulse = 1 + Math.sin(t * 4 + 0.5) * 0.3;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const radius = alert.severity === "direct" ? 0.4 : alert.severity === "near" ? 0.3 : 0.2;
  const opacity = alert.severity === "direct" ? 0.9 : 0.6;

  return (
    <group position={alert.point}>
      {/* Core alert sphere — emissive so the Bloom pass picks it up as a real
          glow. */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={PALETTE.gsConflict}
          emissive={PALETTE.gsConflict}
          emissiveIntensity={2.2}
          transparent
          opacity={opacity}
          roughness={0.4}
        />
      </mesh>
      {/* Glow halo — kept subtle; Bloom contributes the diffuse glow. */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.8, 16, 16]} />
        <meshBasicMaterial color={PALETTE.gsConflict} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {/* Billboarded label (§5 Billboarding mandate) */}
      <Billboard position={[0, radius + 0.5, 0]}>
        <Text
          fontSize={0.25}
          color={PALETTE.gsConflict}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor={PALETTE.gsCanvas}
        >
          {`INDICATIVE CONFLICT: ${(alert.layerId ?? alert.utilityType ?? "layer").toUpperCase()}`}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Render all subsurface utilities + strike alerts. Utilities only render when
 * subsurfaceView is on (read via getState — no re-render).
 */
export function SubsurfaceEngine({
  utilities,
  alerts = [],
}: {
  utilities: SubsurfaceUtility[];
  alerts?: StrikeAlertData[];
}) {
  const subsurfaceView = useSeasonalStore((s) => s.subsurfaceView);
  return (
    <group visible={subsurfaceView}>
      {utilities.map((u) => (
        <SchematicConduit key={u.id} util={u} />
      ))}
      {alerts.map((a) => (
        <StrikePulse key={a.id} alert={a} />
      ))}
    </group>
  );
}

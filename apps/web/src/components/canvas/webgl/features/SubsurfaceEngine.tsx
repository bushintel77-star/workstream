/**
 * Gold Standard 2026 — Subsurface Engine + Strike Alert renderer.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2
 *
 * Renders subsurface utility lines as 3D tube geometry below the ground plane,
 * coloured by APWA convention. Strike Alerts render as red pulse volumes at
 * collision points.
 *
 * Lives inside the R3F <Canvas> (Layer 2). These are Three.js materials with
 * numeric colour values — allowlisted in the chrome-color gate.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { UtilityType } from "@workstream/domain";

// APWA utility locate colours (industry standard, mode-invariant)
const UTILITY_COLORS: Record<UtilityType, string> = {
  gas: "#e8b000",
  water: "#1e88c7",
  sewer: "#2f8f4e",
  electric: "#d63b2f",
  comms: "#e8722f",
  reclaimed: "#8b4fc7",
};

export interface SubsurfaceUtility {
  id: string;
  type: UtilityType;
  start: [number, number]; // metre-space [x, z]
  end: [number, number]; // metre-space [x, z]
  depthM: number;
  toleranceM: number;
}

export interface StrikeAlertData {
  id: string;
  utilityType: UtilityType;
  point: [number, number, number]; // [x, y(=depth), z]
  severity: "direct" | "near" | "proximity";
}

/** A single subsurface utility line rendered as a translucent tube. */
function UtilityTube({ util }: { util: SubsurfaceUtility }) {
  const color = UTILITY_COLORS[util.type] ?? "#6b7078";

  const tubeGeo = useMemo(() => {
    const start = new THREE.Vector3(util.start[0], -util.depthM, util.start[1]);
    const end = new THREE.Vector3(util.end[0], -util.depthM, util.end[1]);
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 0.01) return null;
    const path = new THREE.LineCurve3(start, end);
    return new THREE.TubeGeometry(path, Math.max(2, Math.ceil(length)), util.toleranceM, 8, false);
  }, [util]);

  if (!tubeGeo) return null;

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.6}
          roughness={0.4}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Surface marker — a dashed line on the ground showing the utility path */}
      <Line
        points={[
          [util.start[0], 0.008, util.start[1]],
          [util.end[0], 0.008, util.end[1]],
        ]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.3}
        gapSize={0.2}
        opacity={0.4}
        transparent
      />
    </group>
  );
}

/** A Strike Alert pulse — a red glowing sphere at the collision point. */
function StrikePulse({ alert }: { alert: StrikeAlertData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
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
      {/* Core alert sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={opacity} />
      </mesh>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 2, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
      </mesh>
      {/* Billboarded label (§5 Billboarding mandate) */}
      <Billboard position={[0, radius + 0.5, 0]}>
        <Text
          fontSize={0.25}
          color="#ef4444"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#101418"
        >
          {`STRIKE: ${alert.utilityType.toUpperCase()}`}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Render all subsurface utilities + strike alerts.
 */
export function SubsurfaceEngine({
  utilities,
  alerts = [],
}: {
  utilities: SubsurfaceUtility[];
  alerts?: StrikeAlertData[];
}) {
  return (
    <group>
      {utilities.map((u) => (
        <UtilityTube key={u.id} util={u} />
      ))}
      {alerts.map((a) => (
        <StrikePulse key={a.id} alert={a} />
      ))}
    </group>
  );
}

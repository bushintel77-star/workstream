/** THE RULER IS NOT AN OVERLAY (README §8).
 *  It is line geometry parented to the active SketchCanvasGroup, so chainage tilts with the plane and
 *  scale stays mathematically true under orbit. The HTML mock fakes this with CSS gradients — do not port that.
 *  Crosshair, coordinate chip and snap markers must derive from the SAME stationing. One source of truth. */
import { useMemo } from 'react';
import { Text } from '@react-three/drei';           // troika-three-text, billboarded upright
import * as THREE from 'three';
import { color, type } from './tokens';

const PX_PER_10M_AT_1_200 = 100;
const MAJOR_EVERY_PX = 100;
const MINOR_EVERY_PX = 20;
const BAND_PX = 26;
const MINOR_FRACTION = 0.26;

export interface Stationing { originWorld: THREE.Vector3; metresPerUnit: number; scaleDenominator: number; }

/** Single source of truth: everything measured derives from this. */
export function stationAt(s: Stationing, worldX: number) {
  return (worldX - s.originWorld.x) * s.metresPerUnit;
}

export function PlaneRuler({
  stationing, lengthM, edge = 'south', visible = true,
}: { stationing: Stationing; lengthM: number; edge?: 'south' | 'west'; visible?: boolean }) {

  const { ticks, labels } = useMemo(() => {
    const unitsPerM = 1 / stationing.metresPerUnit;
    const pxPerM = PX_PER_10M_AT_1_200 / 10 * (200 / stationing.scaleDenominator);
    const majorM = MAJOR_EVERY_PX / pxPerM;
    const minorM = MINOR_EVERY_PX / pxPerM;
    const pts: number[] = [];
    const lbl: { m: number; x: number }[] = [];
    for (let m = 0; m <= lengthM + 1e-6; m += minorM) {
      const isMajor = Math.abs(m % majorM) < 1e-6;
      const x = m * unitsPerM;
      const h = (isMajor ? 1 : MINOR_FRACTION) * BAND_PX * unitsPerM * 0.02;
      pts.push(x, 0, 0, x, 0, -h);
      if (isMajor) lbl.push({ m, x });
    }
    return { ticks: new Float32Array(pts), labels: lbl };
  }, [stationing, lengthM]);

  if (!visible) return null;

  return (
    <group position={stationing.originWorld} rotation={edge === 'west' ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ticks, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color.ink} transparent opacity={0.5} />
      </lineSegments>
      {labels.map(({ m, x }) => (
        <Text key={m} position={[x, 0, -0.9]} fontSize={0.62} color={color.ink60}
              font={type.mono} anchorX="left" anchorY="top" billboard>
          {m.toFixed(0)}
        </Text>
      ))}
    </group>
  );
}

/** In 3D the ruler must NOT show chainage — it converts to a horizon band with bearings only (11c). */
export const rulerModeFor = (camera: 'plan' | 'axo' | 'sec' | '3d') =>
  camera === '3d' ? 'horizon-bearings' : camera === 'sec' ? 'vertical-rl' : 'chainage';

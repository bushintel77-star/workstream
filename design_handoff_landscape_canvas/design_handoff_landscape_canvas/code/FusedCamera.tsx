/** Camera dock → rig (4c, README §6.1).
 *  Four named presets, one camera. Transitions blend the PROJECTION MATRIX over 320ms — never a cut,
 *  never two cameras swapped. Strokes stay on their planes through every transition. */
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type CameraMode = 'plan' | 'axo' | 'sec' | '3d';

interface Rig { projection: 'ortho' | 'persp'; tilt: number; orbit: 'off' | 'snap45' | 'free'; }

export const RIGS: Record<CameraMode, Rig> = {
  plan: { projection: 'ortho', tilt: 0,  orbit: 'off'    },
  axo:  { projection: 'ortho', tilt: 22, orbit: 'snap45' },
  sec:  { projection: 'ortho', tilt: 90, orbit: 'off'    },
  '3d': { projection: 'persp', tilt: 28, orbit: 'free'   },
};

export const BLEND_MS = 320;
export const BLEND_MS_3D = 420;                        // 13b: the ruler cross-fades at 60% of this
const EASE = (t: number) => 1 - Math.pow(1 - t, 3);    // ~cubic-bezier(.32,.72,0,1)

function orthoMatrix(aspect: number, zoom: number, near: number, far: number) {
  const h = 40 / zoom, w = h * aspect;
  return new THREE.Matrix4().makeOrthographic(-w, w, h, -h, near, far);
}
function perspMatrix(aspect: number, fov: number, near: number, far: number) {
  return new THREE.Matrix4().makePerspective(
    ...(() => { const t = near * Math.tan((fov * Math.PI) / 360), r = t * aspect;
                return [-r, r, t, -t, near, far] as const; })()
  );
}

export function FusedCamera({ mode, prefersReducedMotion = false }: { mode: CameraMode; prefersReducedMotion?: boolean }) {
  const { camera, size } = useThree();
  const from = useRef(new THREE.Matrix4());
  const to = useRef(new THREE.Matrix4());
  const t = useRef(1);
  const durationMs = useRef(BLEND_MS);

  const aspect = size.width / size.height;
  const near = 0.1, far = 4000;

  useEffect(() => {
    const rig = RIGS[mode];
    from.current.copy(camera.projectionMatrix);
    to.current.copy(rig.projection === 'ortho'
      ? orthoMatrix(aspect, 1, near, far)
      : perspMatrix(aspect, 42, near, far));
    durationMs.current = prefersReducedMotion ? 120 : (mode === '3d' ? BLEND_MS_3D : BLEND_MS);
    t.current = 0;
  }, [mode, aspect, camera, prefersReducedMotion]);

  useFrame((_, delta) => {
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + (delta * 1000) / durationMs.current);
    const k = EASE(t.current);
    // Element-wise lerp of the two projection matrices: the ortho↔persp "fuse".
    const a = from.current.elements, b = to.current.elements, m = camera.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) m[i] = a[i] + (b[i] - a[i]) * k;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  });

  return null;
}

/** Long-press on the active dock button reverts to the previous state (§6.1). */
export const previousMode = (lastMode: CameraMode) => lastMode;

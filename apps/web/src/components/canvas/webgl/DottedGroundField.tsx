"use client";

/**
 * Dotted infinity-canvas ground field.
 *
 * A procedural dot field drawn in WORLD space over the ground plane:
 * - ~1 px dots, antialiased with fwidth (no textures, no moiré, nothing to
 *   flicker as the camera zooms — the field is recomputed per pixel).
 * - World-space spacing with discrete density tiers switched by camera
 *   height (gridTierFor), cross-faded at thresholds, so zooming out
 *   compresses the field into denser coverage instead of shrinking a photo
 *   of a grid.
 * - Opacity breathes: dots fade with distance from the last pointer
 *   position (gridFocal — plain refs, zero React commits), and the whole
 *   field dims in blueprint/subsurface view like the old grid did.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSeasonalStore } from "./seasonalStore";
import { useStudioStore } from "./studioStore";
import { gridFocal, gridTierFor } from "./dottedGrid";

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec3 vWorld;
uniform float uSpacingA;
uniform float uSpacingB;
uniform float uBlend;
uniform vec2 uFocal;
uniform float uFadeRadius;
uniform float uFadeFloor;
uniform float uOpacity;
uniform vec3 uColor;

float dotAt(vec2 p, float spacing) {
  vec2 cell = fract(p / spacing) - 0.5;
  float d = length(cell) * spacing;
  // One screen pixel of dot, antialiased by the local pixel footprint.
  float px = max(fwidth(vWorld.x), fwidth(vWorld.z));
  return 1.0 - smoothstep(px * 0.45, px, d);
}

void main() {
  float a = mix(dotAt(vWorld.xz, uSpacingA), dotAt(vWorld.xz, uSpacingB), uBlend);
  float dist = distance(vWorld.xz, uFocal);
  float focus = mix(uFadeFloor, 1.0, smoothstep(uFadeRadius, uFadeRadius * 0.25, dist));
  float alpha = a * focus * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function DottedGroundField({
  w,
  h,
}: {
  /** Ground context extents in world metres (matches the ground plane). */
  w: number;
  h: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const canvasTheme = useStudioStore((s) => s.canvasTheme);
  // Theme-aware dot color: white on dark, charcoal on light.
  const dotColor = canvasTheme === "DARK" ? "#FFFFFF" : "#1C1917";

  const uniforms = useMemo(
    () => ({
      uSpacingA: { value: 10 },
      uSpacingB: { value: 10 },
      uBlend: { value: 0 },
      uFocal: { value: new THREE.Vector2(0, 0) },
      uFadeRadius: { value: Math.max(w, h) / 2.4 },
      uFadeFloor: { value: 0.22 },
      uOpacity: { value: 0.6 },
      uColor: { value: new THREE.Color(dotColor) },
    }),
    [w, h, dotColor],
  );

  useFrame((state, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const tier = gridTierFor(Math.abs(state.camera.position.y));
    mat.uniforms.uSpacingA.value = tier.spacingA;
    mat.uniforms.uSpacingB.value = tier.spacingB;
    mat.uniforms.uBlend.value = tier.blend;
    mat.uniforms.uFocal.value.set(gridFocal.x, gridFocal.z);

    // Dim the field in blueprint/subsurface view so it doesn't fight the
    // hairline CAD utilities — same behaviour the old line grid had.
    const { subsurfaceView } = useSeasonalStore.getState();
    const target = subsurfaceView ? 0.15 : 0.6;
    const k = Math.min(1, delta * 4);
    mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      mat.uniforms.uOpacity.value,
      target,
      k,
    );
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Gold Standard 2026 — Terrain Material (contoured surface).
 *
 * The terrain keeps its PBR base (sun/shadows/AO all still apply) but gains
 * topographic articulation the flat albedo could never communicate:
 *
 *   - Contour banding — elevation modulo the surveyor's interval (0.5 m real
 *     world) darkens a subtle band on the surface. The relief that lives in
 *     the geometry (±metres after vertical exaggeration) becomes readable
 *     from any light angle.
 *   - Slope-based albedo — steep faces shift toward an earth tone (batter/
 *     cut faces read differently from flat lawn), driven by the world-space
 *     normal, not view space.
 *   - Low-frequency breakup — a cheap hash noise on world x/z kills the
 *     single-colour "mud" read without adding textures.
 *
 * Injected via onBeforeCompile so the standard material's lighting chunks
 * are untouched. The material colour stays live (the subsurface-blueprint
 * vellum lerp keeps working — it just updates material.color).
 */

import * as THREE from "three";
import { VERTICAL_SCALE } from "./terrainMath";

export const CONTOUR_INTERVAL_REAL_M = 0.5;

export function createTerrainMaterial(baseColor: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.92,
    metalness: 0.02,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uContourInterval = {
      value: CONTOUR_INTERVAL_REAL_M * VERTICAL_SCALE,
    };
    shader.uniforms.uSlopeColor = { value: new THREE.Color("#4a4234") };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vElev;
         varying vec3 vWNormal;
         varying vec3 vWPos;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vElev = position.z;
         vWNormal = normalize(mat3(modelMatrix) * normal);
         vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vElev;
         varying vec3 vWNormal;
         varying vec3 vWPos;
         uniform float uContourInterval;
         uniform vec3 uSlopeColor;
         float terrainHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
         }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         {
           // Contour banding — surveyor's interval; the band darkens subtly.
           float band = fract(vElev / uContourInterval);
           float line = 1.0 - smoothstep(0.0, 0.06, min(band, 1.0 - band));
           diffuseColor.rgb *= 1.0 - line * 0.16;
           // Slope-based albedo — world-up normal measures true steepness.
           float steep = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
           diffuseColor.rgb = mix(
             diffuseColor.rgb,
             uSlopeColor,
             smoothstep(0.18, 0.6, steep) * 0.5
           );
           // Low-frequency surface breakup (coarse 0.5 m cells).
           float n = terrainHash(floor(vWPos.xz * 2.0));
           diffuseColor.rgb *= (0.96 + 0.08 * n) * 1.05;
         }`,
      );
  };
  // Distinct program cache key — otherwise the shared standard program is
  // reused without the injection.
  mat.customProgramCacheKey = () => "gs-terrain-contoured";
  return mat;
}

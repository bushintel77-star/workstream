/**
 * Gold Standard 2026 — Terrain Material (contoured surface).
 *
 * The terrain keeps its PBR base (sun/shadows/AO all still apply) but gains
 * topographic articulation the flat albedo could never communicate:
 *
 *   - Slope-based albedo — steep faces shift toward an earth tone (batter/
 *     cut faces read differently from flat lawn), driven by the world-space
 *     normal, not view space.
 *
 * Injected via onBeforeCompile so the standard material's lighting chunks
 * are untouched. The material colour stays live (the subsurface-blueprint
 * vellum lerp keeps working — it just updates material.color).
 */

import * as THREE from "three";

/**
 * Create the terrain material.
 *
 * @param baseColor    Resting albedo (--ws-canvas paper in drafting modes,
 *                     groundOlive on site modes).
 * @param drafting     Paper/drafting mode: the slope albedo goes NEUTRAL
 *                     (a faint shade of the paper tone) so a contoured survey
 *                     reads as a drawing on a sheet, not as a lit earth
 *                     surface. Site mode keeps the warm earth-tone cut faces
 *                     (batter/cut read differently from flat lawn).
 */
export function createTerrainMaterial(baseColor: string, drafting = false): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.92,
    metalness: 0.02,
  });

  // Slope shade only on drafting: a subtle neutral deepen of the paper itself,
  // so relief reads via contour banding without dumping warm brown on the sheet.
  const slopeColor = drafting ? "#DDDCD8" : "#4a4234";

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSlopeColor = { value: new THREE.Color(slopeColor) };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vWNormal = normalize(mat3(modelMatrix) * normal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWNormal;
         uniform vec3 uSlopeColor;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         {
           // Slope-based albedo — world-up normal measures true steepness.
           float steep = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
           diffuseColor.rgb = mix(
             diffuseColor.rgb,
             uSlopeColor,
             smoothstep(0.18, 0.6, steep) * 0.5
           );
         }`,
      );
  };
  // Distinct program cache key — otherwise the shared standard program is
  // reused without the injection.
  mat.customProgramCacheKey = () => "gs-terrain-site-derived";
  return mat;
}

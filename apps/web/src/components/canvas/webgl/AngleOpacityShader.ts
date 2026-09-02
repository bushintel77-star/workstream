"use client";

/**
 * Spatial Sketching — Angle-Based Opacity Shader (Phase 3) + Seasonal
 * Crossfade (Phase 4).
 *
 * When multiple 2.5D sketch planes overlap in 3D space (e.g. transferred tree
 * canopy strokes on vertical planes), the scene becomes visually cluttered
 * when viewed edge-on. This shader mathematically fades strokes to 0% opacity
 * as the camera's viewing angle becomes oblique to their parent canvas plane.
 *
 * Phase 4 adds a seasonal crossfade: the final alpha is multiplied by
 * uSeasonOpacity (0-1), which is driven by the studioStore's winterFactor.
 * Summer-tagged canvases fade out as winter approaches; winter-tagged canvases
 * fade in. This creates the "living pop-up book" seasonal transition.
 *
 * The math:
 *   1. Vertex shader: compute the world-space view direction (cameraPosition -
 *      worldPosition) and pass it to the fragment shader.
 *   2. Fragment shader: compute abs(dot(normalize(vViewDirection),
 *      normalize(uCanvasNormal))). When the dot product approaches 0 (edge-on),
 *      smoothstep(0.0, 0.3, dotProduct) drops the alpha to 0.
 *   3. Fragment shader: multiply the angle alpha by uSeasonOpacity.
 *
 * The canvas normal is computed from the parent SketchCanvas's rotation
 * quaternion: a plane facing positive Y (up) has a local normal of (0,1,0);
 * applying the canvas's quaternion rotates it into world space.
 */

import * as THREE from "three";

/**
 * A standalone THREE.ShaderMaterial implementing angle-based opacity +
 * seasonal crossfade. Used for simple line/point geometry on canvas planes.
 * For strokes that use the NibInkMaterial or StippleMaterial, use
 * patchMaterialForAngleOpacity instead to add the effect while preserving
 * nib rendering.
 */
export class AngleOpacityShader extends THREE.ShaderMaterial {
  constructor(params: {
    color?: THREE.ColorRepresentation;
    canvasNormal?: THREE.Vector3;
    opacity?: number;
    seasonOpacity?: number;
    /** The upper edge of the smoothstep falloff (turn 14c). Lower = gentler
     *  fade (WIDE), higher = steeper fade (NARROW). Default 0.3 (WIDE). */
    falloffEdge1?: number;
  } = {}) {
    super({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBaseColor: { value: new THREE.Color(params.color ?? "#1a1a1a") },
        uCanvasNormal: { value: params.canvasNormal ?? new THREE.Vector3(0, 1, 0) },
        uBaseOpacity: { value: params.opacity ?? 1.0 },
        uSeasonOpacity: { value: params.seasonOpacity ?? 1.0 },
        uFalloffEdge1: { value: params.falloffEdge1 ?? 0.3 },
      },
      vertexShader: /* glsl */ `
        uniform vec3 uCanvasNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vViewDirection = cameraPosition - worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBaseColor;
        uniform vec3 uCanvasNormal;
        uniform float uBaseOpacity;
        uniform float uSeasonOpacity;
        uniform float uFalloffEdge1;
        varying vec3 vViewDirection;
        void main() {
          float dp = abs(dot(normalize(vViewDirection), normalize(uCanvasNormal)));
          float angleAlpha = smoothstep(0.0, uFalloffEdge1, dp);
          gl_FragColor = vec4(uBaseColor, uBaseOpacity * angleAlpha * uSeasonOpacity);
        }
      `,
    });
  }

  get canvasNormal(): THREE.Vector3 {
    return this.uniforms.uCanvasNormal.value as THREE.Vector3;
  }
  set canvasNormal(v: THREE.Vector3) {
    this.uniforms.uCanvasNormal.value = v;
  }

  get seasonOpacity(): number {
    return this.uniforms.uSeasonOpacity.value as number;
  }
  set seasonOpacity(v: number) {
    this.uniforms.uSeasonOpacity.value = v;
  }

  get falloffEdge1(): number {
    return this.uniforms.uFalloffEdge1.value as number;
  }
  set falloffEdge1(v: number) {
    this.uniforms.uFalloffEdge1.value = v;
  }
}

/**
 * Patch a material's onBeforeCompile to add the angle-opacity + seasonal
 * crossfade effect. This preserves the material's existing rendering (nib
 * width, grain, etc.) while multiplying the final alpha by the angle-based
 * fade and the seasonal opacity.
 *
 * The material gets two uniforms: `uCanvasNormal` (vec3) and `uSeasonOpacity`
 * (float, default 1.0). The patch injects the view-direction varying into the
 * vertex shader and the combined alpha multiplier into the fragment shader.
 */
export function patchMaterialForAngleOpacity(
  material: THREE.Material & { uniforms: Record<string, { value: unknown }> },
  canvasNormal: THREE.Vector3,
  seasonOpacity = 1.0,
  /** The upper edge of the smoothstep falloff (turn 14c). Default 0.3 (WIDE). */
  falloffEdge1 = 0.3,
): void {
  // Add the uCanvasNormal uniform if not already present.
  if (!material.uniforms.uCanvasNormal) {
    material.uniforms.uCanvasNormal = { value: canvasNormal.clone() };
  } else {
    (material.uniforms.uCanvasNormal.value as THREE.Vector3).copy(canvasNormal);
  }

  // Add the uSeasonOpacity uniform (Phase 4).
  if (!material.uniforms.uSeasonOpacity) {
    material.uniforms.uSeasonOpacity = { value: seasonOpacity };
  } else {
    material.uniforms.uSeasonOpacity.value = seasonOpacity;
  }

  // Add the uFalloffEdge1 uniform (Phase E, turn 14c).
  if (!material.uniforms.uFalloffEdge1) {
    material.uniforms.uFalloffEdge1 = { value: falloffEdge1 };
  } else {
    material.uniforms.uFalloffEdge1.value = falloffEdge1;
  }

  const originalOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer,
  ) => {
    // Call the original onBeforeCompile first (e.g. NibInkMaterial's patches).
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile.call(material, shader, renderer);
    }

    // Add the uniforms to the shader.
    if (!shader.uniforms.uCanvasNormal) {
      shader.uniforms.uCanvasNormal = material.uniforms.uCanvasNormal;
    }
    if (!shader.uniforms.uSeasonOpacity) {
      shader.uniforms.uSeasonOpacity = material.uniforms.uSeasonOpacity;
    }
    if (!shader.uniforms.uFalloffEdge1) {
      shader.uniforms.uFalloffEdge1 = material.uniforms.uFalloffEdge1;
    }

    // Inject the view-direction varying into the vertex shader.
    // Three.js shaders always have a "void main() {" — we inject before it.
    shader.vertexShader = shader.vertexShader.replace(
      /void main\(\) {/,
      /* glsl */ `
        uniform vec3 uCanvasNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 worldPos_AO = modelMatrix * vec4(position, 1.0);
          vViewDirection = cameraPosition - worldPos_AO.xyz;
      `,
    ).replace(
      /void main\(\) {/,
      `void main() {`,
    );

    // Inject the angle-alpha + season-opacity into the fragment shader.
    // We add the varying + uniform declarations and a function, then
    // multiply gl_FragColor.a by the combined factor at the end of main.
    shader.fragmentShader = shader.fragmentShader.replace(
      /void main\(\) {/,
      /* glsl */ `
        uniform vec3 uCanvasNormal;
        uniform float uSeasonOpacity;
        uniform float uFalloffEdge1;
        varying vec3 vViewDirection;
        float angleOpacityAlpha() {
          float dp = abs(dot(normalize(vViewDirection), normalize(uCanvasNormal)));
          return smoothstep(0.0, uFalloffEdge1, dp);
        }
        void main() {
      `,
    );

    // Multiply the final alpha by the angle-opacity * season-opacity factor.
    // We append this just before the closing brace of main().
    shader.fragmentShader = shader.fragmentShader.replace(
      /\}\s*$/,
      /* glsl */ `
          gl_FragColor.a *= angleOpacityAlpha() * uSeasonOpacity;
        }
      `,
    );
  };

  // Mark the material as needing recompilation.
  material.needsUpdate = true;
}

/**
 * Compute the world-space normal of a SketchCanvas plane.
 *
 * A plane lying flat (identity rotation) has its normal pointing up: (0, 1, 0).
 * Applying the canvas's rotation quaternion rotates this normal into the
 * canvas's world-space orientation.
 */
export function canvasWorldNormal(
  rotation: [number, number, number, number],
): THREE.Vector3 {
  const localNormal = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion(
    rotation[0],
    rotation[1],
    rotation[2],
    rotation[3],
  );
  return localNormal.applyQuaternion(quat);
}

/**
 * Compute the seasonal opacity for a canvas based on its season_tag and the
 * current winterFactor (0 = peak summer, 1 = deep winter).
 *
 * 'SUMMER' — visible in summer (winterFactor=0), invisible in winter (=1).
 * 'WINTER' — invisible in summer, visible in winter.
 * 'ALL'    — always fully visible.
 */
export function seasonOpacityForCanvas(
  seasonTag: "SUMMER" | "WINTER" | "ALL" | undefined,
  winterFactorValue: number,
): number {
  switch (seasonTag) {
    case "SUMMER":
      return 1.0 - winterFactorValue;
    case "WINTER":
      return winterFactorValue;
    case "ALL":
    default:
      return 1.0;
  }
}

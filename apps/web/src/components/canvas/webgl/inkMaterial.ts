/**
 * Gold Standard 2026 — Dynamic ink shaders (the Trace & Bake "live shader"
 * surface).
 *
 * The brief calls for a live shader overlay; in the fused WebGL studio the
 * equivalent is a dedicated INK MATERIAL on the shared R3F context — no
 * second WebGL context, no z-fighting overlay pass. `NibInkMaterial` extends
 * three's LineMaterial (the same primitive drei <Line> renders through) with:
 *
 *   - per-segment width (aWidth instance attribute) — pressure/tilt-driven
 *     tapering for graphite, monoline for technical ink, wide bands for the
 *     chisel;
 *   - procedural grain (uGrain) — hash noise darkening for graphite;
 *   - edge softness (uEdgeSoft) — graphite flat-edge shading / marker bleed;
 *   - wet-ink bleed (uBleed × per-segment aBleed) — technical ink "velocity
 *     bleeds" toward the edge of the stroke.
 *
 * `StippleMaterial` renders the stipple/speckle nib as soft round dots whose
 * size (aSize) scales with stylus altitude and whose alpha follows pressure
 * (aPressure).
 *
 * Shader patches are applied in `onBeforeCompile` with a fail-fast validator
 * (inkMaterial.test.ts asserts every target matches exactly once against the
 * ACTUAL three LineMaterial shader source, so a three bump that renames a
 * target fails loudly instead of silently corrupting the ink).
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md (single WebGL scene graph)
 */

import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export interface NibInkMaterialParams {
  color?: THREE.ColorRepresentation;
  linewidth?: number;
  opacity?: number;
  /** 0–1 graphite grain density. */
  grain?: number;
  /** 0–1 edge softness (fraction of the width that fades). */
  edgeSoft?: number;
  /** 0–1 wet-ink bleed. */
  bleed?: number;
  /** Alcohol-marker multiply blend (spec 3.3) — crossings build up instead
   *  of overwriting. Requires material.transparent. */
  multiply?: boolean;
}

/** Replace each target exactly once — throws on missing or duplicate targets. */
export function patchShader(
  source: string,
  patches: ReadonlyArray<readonly [string, string]>,
): string {
  let out = source;
  for (const [target, replacement] of patches) {
    const first = out.indexOf(target);
    if (first === -1) {
      throw new Error(
        `[inkMaterial] shader patch target not found: "${target.slice(0, 48)}"`,
      );
    }
    if (out.indexOf(target, first + 1) !== -1) {
      throw new Error(
        `[inkMaterial] shader patch target matched twice: "${target.slice(0, 48)}"`,
      );
    }
    out = out.slice(0, first) + replacement + out.slice(first + target.length);
  }
  return out;
}

/**
 * Vertex-shader patches — per-segment width + bleed attributes. Targets are
 * the three@0.185 examples/jsm/lines/LineMaterial.js sources.
 */
export const INK_VERTEX_PATCHES: ReadonlyArray<readonly [string, string]> = [
  [
    "attribute vec3 instanceStart;",
    "attribute vec3 instanceStart;\n\t\tattribute float aWidth;\n\t\tattribute float aBleed;\n\t\tvarying float vBleed;",
  ],
  [
    "vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );",
    "vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );\n\t\t\tvBleed = aBleed;",
  ],
  [
    "float hw = linewidth * 0.5;",
    "float hw = linewidth * aWidth * 0.5;",
  ],
  ["offset *= linewidth;", "offset *= linewidth * aWidth;"],
];

/** Fragment-shader patches — grain, edge softness, wet-ink bleed. */
export const INK_FRAGMENT_PATCHES: ReadonlyArray<readonly [string, string]> = [
  [
    "uniform float linewidth;",
    "uniform float linewidth;\n\t\tuniform float uGrain;\n\t\tuniform float uEdgeSoft;\n\t\tuniform float uBleed;",
  ],
  [
    "varying float vLineDistance;",
    "varying float vLineDistance;\n\t\tvarying float vBleed;",
  ],
  [
    "if ( len2 > 1.0 ) discard;",
    [
      "if ( len2 > 1.0 ) discard;",
      "",
      "\t\t\t\tfloat edgeFade = clamp( ( 1.0 - abs( vUv.y ) ) / max( uEdgeSoft, 0.001 ), 0.0, 1.0 );",
      "\t\t\t\talpha *= edgeFade;",
    ].join("\n"),
  ],
  [
    "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
    [
      "float grainN = fract( sin( dot( gl_FragCoord.xy, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );",
      "\t\t\tdiffuseColor.rgb *= mix( 1.0, 0.62 + 0.38 * grainN, uGrain );",
      "#ifndef WORLD_UNITS",
      "\t\t\t\tdiffuseColor.rgb *= mix( 1.0, 0.9, uBleed * vBleed * ( 1.0 - abs( vUv.y ) ) );",
      "\t\t\t\talpha *= clamp( 0.85 + 0.3 * vBleed, 0.5, 1.0 );",
      "#endif",
      "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
    ].join("\n"),
  ],
];

/**
 * The dynamic ink material for graphite / technical-ink / chisel strokes.
 * Pixel-width mode (worldUnits off) — linewidth is in CSS px, per-segment
 * `aWidth` scales it, per-segment `aBleed` drives velocity bleed.
 */
export class NibInkMaterial extends LineMaterial {
  constructor(params: NibInkMaterialParams = {}) {
    super({
      color: params.color ?? "#1a1a1a",
      linewidth: params.linewidth ?? 2,
      opacity: params.opacity ?? 0.85,
      transparent: true,
      depthWrite: false,
      worldUnits: false,
    });
    this.uniforms.uGrain = { value: params.grain ?? 0 };
    this.uniforms.uEdgeSoft = { value: params.edgeSoft ?? 0 };
    this.uniforms.uBleed = { value: params.bleed ?? 0 };
    // Alcohol marker: multiply the incoming ink against what is already on
    // the paper (src * dst). Two crossing marker strokes darken where they
    // overlap — the marker's organic build-up, not an opacity overwrite.
    if (params.multiply) {
      this.blending = THREE.CustomBlending;
      this.blendSrc = THREE.ZeroFactor;
      this.blendDst = THREE.SrcColorFactor;
    }

    this.onBeforeCompile = (
      shader: THREE.WebGLProgramParametersWithUniforms,
    ) => {
      shader.vertexShader = patchShader(shader.vertexShader, INK_VERTEX_PATCHES);
      shader.fragmentShader = patchShader(
        shader.fragmentShader,
        INK_FRAGMENT_PATCHES,
      );
    };
  }

  /** 0–1 graphite grain density. */
  get grain(): number {
    return this.uniforms.uGrain.value;
  }
  set grain(v: number) {
    this.uniforms.uGrain.value = v;
  }

  /** 0–1 edge softness (fraction of the width that fades). */
  get edgeSoft(): number {
    return this.uniforms.uEdgeSoft.value;
  }
  set edgeSoft(v: number) {
    this.uniforms.uEdgeSoft.value = v;
  }

  /** 0–1 wet-ink bleed. */
  get bleed(): number {
    return this.uniforms.uBleed.value;
  }
  set bleed(v: number) {
    this.uniforms.uBleed.value = v;
  }
}

export interface StippleMaterialParams {
  color?: THREE.ColorRepresentation;
  opacity?: number;
}

/**
 * The stipple/speckle nib material — soft round dots (fragment disc + AA
 * falloff) with per-point size (aSize) and pressure-driven alpha (aPressure).
 * `uScale` is the viewport height in device px ÷ 2 (PointsMaterial
 * convention) and is updated per frame by the renderer.
 */
export class StippleMaterial extends THREE.ShaderMaterial {
  constructor(params: StippleMaterialParams = {}) {
    super({
      uniforms: {
        uColor: { value: new THREE.Color(params.color ?? "#8B6F4E") },
        uOpacity: { value: params.opacity ?? 0.8 },
        uScale: { value: 300 },
      },
      vertexShader: /* glsl */ `
				attribute float aSize;
				attribute float aPressure;
				uniform float uScale;
				varying float vAlpha;
				void main() {
					vAlpha = 0.55 + 0.45 * aPressure;
					vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
					gl_PointSize = aSize * uScale / max( 0.1, -mvPosition.z );
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
      fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				uniform float uOpacity;
				varying float vAlpha;
				void main() {
					vec2 d = gl_PointCoord - 0.5;
					float r = length( d ) * 2.0;
					float a = smoothstep( 1.0, 0.3, r ) * uOpacity * vAlpha;
					if ( a < 0.02 ) discard;
					gl_FragColor = vec4( uColor, a );
				}
			`,
      transparent: true,
      depthWrite: false,
    });
  }
}

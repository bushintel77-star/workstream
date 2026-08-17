"use client";

/**
 * Demo garden — Tier-1 render pipeline proof (physical sky + IBL, PBR
 * grounds, instanced planting, growth-stage trees).
 *
 * Standalone showcase surface for /demo/garden: it does NOT touch the
 * operator studio or the Gold Standard chrome laws. Everything here is the
 * candidate upgrade path for the WebGL studio's real-time quality tier:
 *
 *   - three.js <Sky> with a matched PMREM environment (golden-hour sun)
 *   - CC0 PBR texture sets (ambientCG — Grass001, Ground054,
 *     PavingStones045, Bark006; all CC0, no attribution required)
 *   - instanced grass blades with a wind vertex shader
 *   - beveled paver path laid along a curve
 *   - procedural trees at three growth stages (age-driven params — the
 *     mapping the growth-year slider will use)
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  N8AO,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

/* Golden-hour sun — low elevation for long soft shadows. */
const SUN_ELEVATION_DEG = 16;
const SUN_AZIMUTH_DEG = 205;

function sunDirection(): THREE.Vector3 {
  return new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - SUN_ELEVATION_DEG),
    THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG),
  );
}

/**
 * Gradient sky dome — warm horizon to blue zenith with an HDR sun disc.
 * Deterministic at every sun angle (three's physical Sky shader proved
 * unstable across elevation changes in this stack), and because the PMREM
 * environment below is generated from the SAME dome, every PBR material
 * is lit coherently with the sky the shadows come from.
 */
function makeSkyDomeMaterial(sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: sun.clone() },
      uZenith: { value: new THREE.Color("#4a77ad") },
      uHorizon: { value: new THREE.Color("#ead9bd") },
      uSunWarm: { value: new THREE.Color("#ffd9a0") },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunWarm;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
        float cosSun = max(dot(d, normalize(uSun)), 0.0);
        col += uSunWarm * (pow(cosSun, 350.0) * 14.0 + pow(cosSun, 8.0) * 0.5);
        col = mix(col, vec3(0.87, 0.88, 0.9), smoothstep(0.0, -0.08, d.y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Sky dome + matched image-based lighting. The dome paints the background;
 * a second identical dome is captured through PMREMGenerator so every PBR
 * material is lit by the same sky the sun came from.
 */
function SunSkyEnvironment() {
  const { scene, gl } = useThree();

  useEffect(() => {
    const sun = sunDirection();
    const material = makeSkyDomeMaterial(sun);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 20),
      material,
    );
    dome.scale.setScalar(900);
    scene.add(dome);

    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const envDome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 20),
      makeSkyDomeMaterial(sun),
    );
    envScene.add(envDome);
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.6;

    return () => {
      scene.remove(dome);
      scene.environment = null;
      dome.geometry.dispose();
      material.dispose();
      envDome.geometry.dispose();
      envDome.material.dispose();
      envRT.dispose();
      pmrem.dispose();
    };
  }, [scene, gl]);

  const sun = useMemo(sunDirection, []);
  return (
    <directionalLight
      castShadow
      position={[sun.x * 60, sun.y * 60, sun.z * 60]}
      intensity={3.4}
      color="#ffe2b8"
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
      shadow-camera-near={5}
      shadow-camera-far={140}
      shadow-bias={-0.00035}
      shadow-normalBias={0.025}
    />
  );
}

type GroundMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
};

/** Load a staged CC0 set and make it a tiling PBR material input. */
function usePbrSet(
  base: string,
  repeatX: number,
  repeatY: number,
  withRoughness = false,
): GroundMaps {
  const paths = withRoughness
    ? [`${base}/color.jpg`, `${base}/normal.jpg`, `${base}/roughness.jpg`]
    : [`${base}/color.jpg`, `${base}/normal.jpg`];
  const textures = useTexture(paths);
  const [map, normalMap, roughnessMap] = textures;
  useLayoutEffect(() => {
    for (const t of textures) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 8;
    }
    map.colorSpace = THREE.SRGBColorSpace;
  }, [textures, map, repeatX, repeatY]);
  return { map, normalMap, roughnessMap };
}

function Lawn() {
  const { map, normalMap, roughnessMap } = usePbrSet(
    "/demo-assets/lawn",
    18,
    18,
    true,
  );
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
      <planeGeometry args={[46, 46]} />
      <meshStandardMaterial
        map={map}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        normalScale={new THREE.Vector2(0.8, 0.8)}
      />
    </mesh>
  );
}

/** Rounded-rect bed shape (bevel rule: extruded, never a flat plane). */
function bedShape(w: number, d: number, r = 1.1): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const BEDS: { x: number; z: number; w: number; d: number }[] = [
  { x: -6.8, z: -3.2, w: 8.4, d: 5.2 },
  { x: 6.6, z: 3.6, w: 7.2, d: 4.6 },
];

function Beds() {
  const { map, normalMap } = usePbrSet("/demo-assets/beds", 5, 3.5);
  const geoms = useMemo(
    () =>
      BEDS.map(
        (b) =>
          new THREE.ExtrudeGeometry(bedShape(b.w, b.d), {
            depth: 0.09,
            bevelEnabled: true,
            bevelSize: 0.05,
            bevelThickness: 0.03,
            bevelSegments: 2,
          }),
      ),
    [],
  );
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  return (
    <>
      {BEDS.map((b, i) => (
        <mesh
          key={i}
          geometry={geoms[i]}
          position={[b.x, 0, b.z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            map={map}
            normalMap={normalMap}
            color="#b7a894"
            roughness={1}
          />
        </mesh>
      ))}
    </>
  );
}

/** Turberware edge — plain rough timber boxes framing the beds. */
function BedEdging() {
  return (
    <>
      {BEDS.map((b, i) => (
        <group key={i} position={[b.x, 0.09, b.z]}>
          {[
            [0, b.d / 2, b.w, 0],
            [0, -b.d / 2, b.w, 0],
            [b.w / 2, 0, b.d, Math.PI / 2],
            [-b.w / 2, 0, b.d, Math.PI / 2],
          ].map(([ex, ez, len, rot], j) => (
            <mesh
              key={j}
              position={[ex, 0.055, ez]}
              rotation-y={rot}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[len, 0.11, 0.09]} />
              <meshStandardMaterial color="#6d5a44" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * Instanced grass blades with a wind vertex shader. Phase comes from the
 * instance translation so every blade sways independently; amplitude ramps
 * with local height so roots stay planted.
 */
function GrassClumps({ count = 2400 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const wind = useRef({ value: 0 });

  const bladeGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.05, 1, 1, 3);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const bed = BEDS[i % BEDS.length];
      const jitter = () => (Math.random() - 0.5) * 0.9;
      pos.set(
        bed.x + (Math.random() - 0.5) * (bed.w - 0.6) + jitter() * 0.2,
        0.1,
        bed.z + (Math.random() - 0.5) * (bed.d - 0.6) + jitter() * 0.2,
      );
      q.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.random() * Math.PI * 2,
      );
      const h = 0.22 + Math.random() * 0.3;
      scale.set(0.8 + Math.random() * 0.7, h, 1);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      // Two-tone greens — deepen toward the bed centres.
      const t = Math.random();
      color.setHSL(0.26 + t * 0.03, 0.42 + t * 0.18, 0.24 + t * 0.14);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wind.current;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;",
        )
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float wPhase = uTime * 1.9
            + instanceMatrix[3].x * 2.3
            + instanceMatrix[3].z * 1.7;
          float wAmt = 0.085 * smoothstep(0.0, 1.0, position.y);
          transformed.x += sin(wPhase) * wAmt;
          transformed.z += cos(wPhase * 0.77) * wAmt * 0.55;
        #endif
        `,
        );
    };
    mat.customProgramCacheKey = () => "demo-grass-wind";
    return mat;
  }, []);

  useEffect(
    () => () => {
      bladeGeo.dispose();
      material.dispose();
    },
    [bladeGeo, material],
  );

  useFrame((state) => {
    wind.current.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[bladeGeo, material, count]}
      castShadow
      receiveShadow
    />
  );
}

/** Paver path — instanced beveled stones laid along a gentle S-curve. */
function PaverPath() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { map, normalMap, roughnessMap } = usePbrSet(
    "/demo-assets/pavers",
    1,
    1,
    true,
  );

  const stones = useMemo(() => {
    const pts: { pos: THREE.Vector3; rotY: number }[] = [];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-13, 0, 7.5),
      new THREE.Vector3(-4, 0, 4.2),
      new THREE.Vector3(1.5, 0, 0.5),
      new THREE.Vector3(7, 0, -1.8),
      new THREE.Vector3(14, 0, -4.5),
    ]);
    const n = 44;
    const tangent = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = curve.getPoint(t);
      curve.getTangent(t, tangent);
      pts.push({
        pos: new THREE.Vector3(p.x, 0.052, p.z),
        rotY:
          Math.atan2(tangent.x, tangent.z) +
          (i % 2 === 0 ? 1 : -1) * (0.05 + Math.random() * 0.04),
      });
    }
    return pts;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    stones.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rotY);
      m.compose(
        s.pos,
        q,
        new THREE.Vector3(1, 1, 1).multiplyScalar(0.98 + Math.random() * 0.05),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [stones]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, stones.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.62, 0.045, 0.42]} />
      <meshStandardMaterial
        map={map}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        normalScale={new THREE.Vector2(1.1, 1.1)}
      />
    </instancedMesh>
  );
}

/**
 * Procedural tree at a growth stage. Age drives trunk height/taper and
 * canopy spread/cluster count — the parameter mapping the growth-year
 * slider will formalise when the botanical library lands.
 */
function Tree({
  position,
  stage,
}: {
  position: [number, number, number];
  stage: "young" | "mature" | "specimen";
}) {
  const { map, normalMap } = usePbrSet("/demo-assets/bark", 2, 3);
  const params =
    stage === "young"
      ? { trunk: 1.7, r: 0.075, canopy: 0.75, blobs: 6 }
      : stage === "mature"
        ? { trunk: 3.4, r: 0.14, canopy: 1.55, blobs: 9 }
        : { trunk: 4.8, r: 0.2, canopy: 2.3, blobs: 12 };

  const blobs = useMemo(() => {
    const list: { p: [number, number, number]; r: number; tone: number }[] = [];
    for (let i = 0; i < params.blobs; i++) {
      const a = (i / params.blobs) * Math.PI * 2 + Math.random();
      const rad = params.canopy * (0.35 + Math.random() * 0.55);
      list.push({
        p: [
          Math.cos(a) * rad,
          params.trunk * (0.82 + Math.random() * 0.28),
          Math.sin(a) * rad,
        ],
        r: params.canopy * (0.42 + Math.random() * 0.3),
        tone: Math.random(),
      });
    }
    return list;
  }, [params.blobs, params.canopy, params.trunk]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position-y={params.trunk / 2}>
        <cylinderGeometry
          args={[params.r * 0.66, params.r, params.trunk, 10, 3]}
        />
        <meshStandardMaterial
          map={map}
          normalMap={normalMap}
          roughness={0.95}
        />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p} castShadow receiveShadow>
          <icosahedronGeometry args={[b.r, 1]} />
          <meshStandardMaterial
            color={new THREE.Color().setHSL(
              0.26 + b.tone * 0.035,
              0.4 + b.tone * 0.2,
              0.22 + b.tone * 0.13,
            )}
            roughness={0.92}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function DemoFX() {
  return (
    <EffectComposer multisampling={4} enableNormalPass>
      <N8AO
        aoRadius={5}
        intensity={1.05}
        distanceFalloff={0.8}
        quality="medium"
        color="black"
      />
      <Bloom
        intensity={0.12}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      {/* Tone mapping lives HERE, not on the renderer — the composer renders
          HDR and the physical sky exceeds 1.0 by orders of magnitude. AgX
          rolls bright skies off without the white-clip ACES shows here. */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.42} darkness={0.13} />
    </EffectComposer>
  );
}

function SceneTone() {
  const { scene, gl } = useThree();
  useEffect(() => {
    // Off here on purpose — the composer's ToneMapping effect owns it.
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.Fog(new THREE.Color("#dfe3e8"), 55, 240);
    return () => {
      scene.fog = null;
    };
  }, [scene, gl]);
  return null;
}

export function DemoGarden() {
  return (
    <div
      data-testid="demo-garden"
      style={{ position: "fixed", inset: 0, background: "#101418" }}
    >
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [11, 4.4, 13], fov: 38, near: 0.1, far: 3000 }}
        gl={{ antialias: true }}
      >
        <SceneTone />
        <SunSkyEnvironment />
        <Lawn />
        <Beds />
        <BedEdging />
        <GrassClumps />
        <PaverPath />
        <Tree position={[-8.6, 0, -5.4]} stage="young" />
        <Tree position={[4.4, 0, -6.2]} stage="mature" />
        <Tree position={[10.8, 0, -3.4]} stage="specimen" />
        <DemoFX />
        <OrbitControls
          target={[0, 0.9, 0]}
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          left: 14,
          bottom: 14,
          padding: "7px 12px",
          borderRadius: 10,
          background: "rgba(16,20,24,0.72)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#e8eaed",
          fontFamily: "var(--font-tech, monospace)",
          fontSize: 11,
          letterSpacing: "0.05em",
          pointerEvents: "none",
        }}
      >
        DEMO GARDEN — physical sky · CC0 PBR grounds · instanced planting ·
        growth stages
      </div>
    </div>
  );
}

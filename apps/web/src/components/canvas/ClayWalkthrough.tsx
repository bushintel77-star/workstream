"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import css from "./clayWalkthrough.module.css";

/** Closed ring in lot metres (SW origin, plan Y-up). */
export type ClayRing = {
  points: Array<[number, number]>;
  height: number;
};

/** Open or closed polylines for fence / restraint InstancedMesh. */
export type ClayPolyline = {
  points: Array<[number, number]>;
  height?: number;
};

/** Planting insert / circle centres. */
export type ClayPlant = {
  x: number;
  y: number;
  scale?: number;
};

export type ClayWalkthroughProps = {
  active: boolean;
  rings: ClayRing[];
  polylines?: ClayPolyline[];
  plants?: ClayPlant[];
  className?: string;
  /** Esc when look is unlocked (or second Esc) leaves Walk mode. */
  onRequestExit?: () => void;
};

const EYE_H = 1.6;
const MOVE_SPEED = 4.2;
const FENCE_SEG_LEN = 0.55;
const FENCE_H = 1.1;
const FENCE_W = 0.08;
const FENCE_D = 0.5;

function makeMatcapTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size * 0.35,
    size * 0.32,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.62,
  );
  g.addColorStop(0, "#f4ebe4");
  g.addColorStop(0.35, "#d4c4b8");
  g.addColorStop(0.7, "#9a8b80");
  g.addColorStop(1, "#4a403a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function openRing(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length < 2) return pts;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return pts.slice(0, -1);
  return pts;
}

/** Plan (x,y) ? Three (x, yUp, z) with Z = ?planY so +Y plan faces camera "north". */
function toWorld(x: number, y: number, yUp = 0): THREE.Vector3 {
  return new THREE.Vector3(x, yUp, -y);
}

function extrudeRing(
  ring: ClayRing,
  mat: THREE.Material,
): THREE.Mesh | null {
  const pts = openRing(ring.points);
  if (pts.length < 3 || ring.height <= 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i]![0], pts[i]![1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: ring.height,
    bevelEnabled: false,
  });
  // Extrude along +Z in shape space; rotate so extrusion is world +Y
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function segmentCount(poly: ClayPolyline): number {
  const pts = poly.points;
  if (pts.length < 2) return 0;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    n += Math.max(1, Math.ceil(len / FENCE_SEG_LEN));
  }
  return n;
}

export function ClayWalkthrough({
  active,
  rings,
  polylines = [],
  plants = [],
  className,
  onRequestExit,
}: ClayWalkthroughProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLParagraphElement | null>(null);
  const exitRef = useRef(onRequestExit);
  exitRef.current = onRequestExit;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Stable scene fingerprint - avoid remounting Three on parent re-renders
  const sceneKey = JSON.stringify({ rings, polylines, plants });

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xcfc4bb, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = css.canvas;
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Soft clay wash so cross-fade reads over the 2D sheet
    scene.fog = new THREE.FogExp2(0xcfc4bb, 0.045);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 200);
    const controls = new PointerLockControls(camera, renderer.domElement);

    const matcap = makeMatcapTexture();
    const clayMat = new THREE.MeshMatcapMaterial({
      matcap,
      color: 0xe8ddd4,
    });
    const hemi = new THREE.HemisphereLight(0xf0e8e0, 0x2a2420, 0.7);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff6ee, 0.95);
    key.position.set(8, 14, 4);
    scene.add(key);
    const fill = new THREE.AmbientLight(0x1a1614, 0.28);
    scene.add(fill);

    const colliders: THREE.Object3D[] = [];
    const root = new THREE.Group();
    scene.add(root);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const r of rings) {
      for (const [x, y] of r.points) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const mesh = extrudeRing(r, clayMat);
      if (mesh) {
        root.add(mesh);
        colliders.push(mesh);
      }
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      maxX = 12;
      minY = 0;
      maxY = 12;
    }

    // Terrain plane for raycast foot height
    const groundW = Math.max(4, maxX - minX + 4);
    const groundD = Math.max(4, maxY - minY + 4);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundW, groundD),
      new THREE.MeshMatcapMaterial({
        matcap,
        color: 0xd8cec4,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((minX + maxX) / 2, 0, -(minY + maxY) / 2);
    ground.receiveShadow = true;
    root.add(ground);
    colliders.push(ground);

    // Fence / restraint segments via InstancedMesh
    let fenceTotal = 0;
    for (const p of polylines) fenceTotal += segmentCount(p);
    if (fenceTotal > 0) {
      const fenceGeo = new THREE.BoxGeometry(FENCE_W, FENCE_H, FENCE_D);
      const fenceMat = new THREE.MeshMatcapMaterial({
        matcap,
        color: 0xcbbfb4,
      });
      const fence = new THREE.InstancedMesh(fenceGeo, fenceMat, fenceTotal);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (const poly of polylines) {
        const h = poly.height ?? FENCE_H;
        const pts = poly.points;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy);
          const segs = Math.max(1, Math.ceil(len / FENCE_SEG_LEN));
          for (let s = 0; s < segs; s++) {
            const t0 = s / segs;
            const t1 = (s + 1) / segs;
            const mx = a[0] + dx * ((t0 + t1) / 2);
            const my = a[1] + dy * ((t0 + t1) / 2);
            const yaw = Math.atan2(-dy, dx);
            dummy.position.set(mx, h / 2, -my);
            dummy.rotation.set(0, yaw, 0);
            const segLen = len / segs;
            dummy.scale.set(1, h / FENCE_H, Math.max(0.2, segLen / FENCE_D));
            dummy.updateMatrix();
            fence.setMatrixAt(idx++, dummy.matrix);
          }
        }
      }
      fence.instanceMatrix.needsUpdate = true;
      root.add(fence);
    }

    // Vegetation: icosahedron crowns + thin plane ?leaf? sprites (no glTF)
    const plantMat = new THREE.MeshMatcapMaterial({
      matcap,
      color: 0xb9b0a6,
    });
    const plantGeo = new THREE.IcosahedronGeometry(0.35, 1);
    const leafGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const leafMat = new THREE.MeshMatcapMaterial({
      matcap,
      color: 0xc4bbb0,
      side: THREE.DoubleSide,
    });
    for (const p of plants) {
      const s = p.scale ?? 1;
      const crown = new THREE.Mesh(plantGeo, plantMat);
      crown.position.set(p.x, 0.45 * s, -p.y);
      crown.scale.setScalar(s);
      root.add(crown);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(p.x, 0.85 * s, -p.y);
      leaf.scale.setScalar(s);
      root.add(leaf);
    }

    const spawn = toWorld(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      EYE_H,
    );
    camera.position.copy(spawn);
    camera.lookAt(spawn.x, EYE_H, spawn.z - 3);

    const keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (e.code === "Escape") {
        e.preventDefault();
        if (controls.isLocked) {
          controls.unlock();
        } else {
          exitRef.current?.();
        }
        return;
      }
      if (e.code === "KeyW" || e.code === "ArrowUp") keys.forward = true;
      if (e.code === "KeyS" || e.code === "ArrowDown") keys.back = true;
      if (e.code === "KeyA" || e.code === "ArrowLeft") keys.left = true;
      if (e.code === "KeyD" || e.code === "ArrowRight") keys.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") keys.forward = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") keys.back = false;
      if (e.code === "KeyA" || e.code === "ArrowLeft") keys.left = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") keys.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onClick = () => {
      if (!activeRef.current) return;
      if (!controls.isLocked) controls.lock();
    };
    renderer.domElement.addEventListener("click", onClick);

    const updateHint = () => {
      if (!hintRef.current) return;
      hintRef.current.innerHTML = controls.isLocked
        ? "<kbd>WASD</kbd> move - <kbd>Esc</kbd> release look"
        : "Click to look - <kbd>WASD</kbd> - <kbd>Esc</kbd> exit walk";
    };
    controls.addEventListener("lock", updateHint);
    controls.addEventListener("unlock", updateHint);
    updateHint();

    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const clock = new THREE.Clock();
    let raf = 0;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const ssao = new SSAOPass(scene, camera, 1, 1);
    ssao.kernelRadius = 8;
    ssao.minDistance = 0.005;
    ssao.maxDistance = 0.12;
    composer.addPass(ssao);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      ssao.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const applyTerrainHeight = () => {
      raycaster.set(
        new THREE.Vector3(camera.position.x, 40, camera.position.z),
        down,
      );
      const hits = raycaster.intersectObjects(colliders, false);
      const hit = hits[0];
      if (hit) {
        camera.position.y = hit.point.y + EYE_H;
      } else {
        camera.position.y = EYE_H;
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!activeRef.current) {
        if (controls.isLocked) controls.unlock();
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      if (controls.isLocked) {
        const dir = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        if (keys.forward) dir.add(forward);
        if (keys.back) dir.sub(forward);
        if (keys.right) dir.add(right);
        if (keys.left) dir.sub(right);
        if (dir.lengthSq() > 0) {
          dir.normalize().multiplyScalar(MOVE_SPEED * dt);
          controls.object.position.add(dir);
        }
      }
      applyTerrainHeight();
      composer.render();
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("click", onClick);
      controls.removeEventListener("lock", updateHint);
      controls.removeEventListener("unlock", updateHint);
      if (controls.isLocked) controls.unlock();
      controls.dispose();
      composer.dispose();
      matcap.dispose();
      clayMat.dispose();
      plantGeo.dispose();
      leafGeo.dispose();
      plantMat.dispose();
      leafMat.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry?.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else if (m && m !== clayMat && m !== plantMat && m !== leafMat)
            m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
    // Mount once per scene; `active` only fades via CSS + activeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  return (
    <div
      ref={hostRef}
      className={`${css.overlay}${active ? ` ${css.overlayActive}` : ""}${
        className ? ` ${className}` : ""
      }`}
      aria-hidden={!active}
      data-testid="clay-walkthrough"
    >
      {active ? <p ref={hintRef} className={css.hint} /> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import css from "./heroDetailOverlay.module.css";

export type HeroFeatureTarget = {
  id: string;
  title: string;
  kind: "wall" | "patio" | "deck" | "water" | "planting" | "path" | "other";
  width_m?: number;
  depth_m?: number;
  height_m?: number;
  material?: string;
  qty_note?: string;
  rate_note?: string;
};

type Props = {
  feature: HeroFeatureTarget | null;
  onClose: () => void;
  /** Freeze current tip as a named client option (design-branch VCS). */
  onFreeze?: () => void;
};

const OPEN_MS = 250;

export function HeroDetailOverlay({ feature, onClose, onFreeze }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [sunDeg, setSunDeg] = useState(42);
  const [specsOpen, setSpecsOpen] = useState(false);
  const sunRef = useRef(sunDeg);
  sunRef.current = sunDeg;

  useEffect(() => {
    if (!feature || !hostRef.current) return;
    const host = hostRef.current;
    const w = host.clientWidth || 480;
    const h = host.clientHeight || 320;
    const scene = new THREE.Scene();
    // Numeric THREE materials — keep out of the chrome #hex gate (render values).
    scene.background = new THREE.Color(0x1a1416);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(2.4, 1.8, 2.8);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    host.appendChild(renderer.domElement);

    // Enhanced lighting setup
    const amb = new THREE.AmbientLight(0xfff0e8, 0.35);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffe2c4, 1.4);
    dir.position.set(2, 3, 2);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 10;
    dir.shadow.camera.left = -3;
    dir.shadow.camera.right = 3;
    dir.shadow.camera.top = 3;
    dir.shadow.camera.bottom = -3;
    dir.shadow.bias = -0.0001;
    scene.add(dir);

    // Add fill light for better dimensionality
    const fillLight = new THREE.DirectionalLight(0xe8e0d8, 0.3);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);

    // Add subtle rim light
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.88,
        metalness: 0.12,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Premium materials with better PBR properties
    const mat = new THREE.MeshStandardMaterial({
      color:
        feature.kind === "planting"
          ? 0x4a6a3a
          : feature.kind === "water"
            ? 0x3a5a6a
            : 0xd4c4b4,
      roughness: 0.65,
      metalness: 0.15,
      envMapIntensity: 0.8,
    });

    // Enhanced geometries with more detail per feature kind
    const mesh: THREE.Group = new THREE.Group();
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e0d8,
      roughness: 0.4,
      metalness: 0.2,
    });

    if (feature.kind === "wall") {
      const mainWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.28), mat);
      mainWall.castShadow = true;
      mainWall.receiveShadow = true;
      mesh.add(mainWall);

      const topEdge = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.04, 0.32), edgeMat);
      topEdge.position.y = 0.46;
      mesh.add(topEdge);

      mesh.position.y = 0.45;
    } else if (feature.kind === "planting") {
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 16), mat);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      mesh.add(foliage);

      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5a4a3a,
        roughness: 0.9,
        metalness: 0.0,
      });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8), trunkMat);
      trunk.position.y = -0.4;
      trunk.castShadow = true;
      mesh.add(trunk);

      mesh.position.y = 0.6;
    } else if (feature.kind === "water") {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x3a5a6a,
        roughness: 0.15,
        metalness: 0.6,
        transparent: true,
        opacity: 0.85,
      });
      const pool = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.1), waterMat);
      pool.castShadow = true;
      pool.receiveShadow = true;
      mesh.add(pool);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 32), edgeMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.05;
      mesh.add(rim);

      mesh.position.y = 0.04;
    } else if (feature.kind === "path") {
      const pathMat = new THREE.MeshStandardMaterial({
        color: 0xc4b494,
        roughness: 0.8,
        metalness: 0.05,
      });
      const path = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.6), pathMat);
      path.castShadow = true;
      path.receiveShadow = true;
      mesh.add(path);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.01, 0.65), edgeMat);
      edge.position.y = 0.02;
      mesh.add(edge);

      mesh.position.y = 0.02;
    } else {
      const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.1), mat);
      mainDeck.castShadow = true;
      mainDeck.receiveShadow = true;
      mesh.add(mainDeck);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.02, 1.15), edgeMat);
      edge.position.y = 0.06;
      mesh.add(edge);

      mesh.position.y = 0.06;
    }

    scene.add(mesh);

    let raf = 0;
    const raycaster = new THREE.Raycaster();
    const anchor = new THREE.Vector3(
      0,
      feature.kind === "planting" ? 0.42 : 0.3,
      0.16,
    );
    const projected = new THREE.Vector3();
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };

    host.addEventListener('mousemove', handleMouseMove);

    const tick = () => {
      const az = (sunRef.current * Math.PI) / 180;
      dir.position.set(Math.cos(az) * 3, 2.2, Math.sin(az) * 3);

      // Smooth camera movement based on mouse position
      targetRotationX = mouseY * 0.3;
      targetRotationY = mouseX * 0.3;

      camera.position.x += ((2.4 + targetRotationY) - camera.position.x) * 0.05;
      camera.position.y += ((1.8 - targetRotationX) - camera.position.y) * 0.05;
      camera.lookAt(0, 0.4, 0);

      // Gentle rotation
      mesh.rotation.y += 0.002;

      const label = labelRef.current;
      if (label) {
        projected.copy(anchor).applyMatrix4(mesh.matrixWorld).project(camera);
        const visible = projected.z >= -1 && projected.z <= 1;
        if (visible) {
          const target = anchor.clone().applyMatrix4(mesh.matrixWorld);
          const direction = target.clone().sub(camera.position).normalize();
          const targetDistance = camera.position.distanceTo(target);
          raycaster.set(camera.position, direction);
          const occluded = raycaster
            .intersectObject(mesh, true)
            .some((hit) => hit.distance < targetDistance - 0.08);
          const scale = Math.max(
            0.78,
            Math.min(1.28, 2.8 / camera.position.distanceTo(target)),
          );
          label.style.left = `${((projected.x + 1) / 2) * 100}%`;
          label.style.top = `${((1 - projected.y) / 2) * 100}%`;
          label.style.opacity = occluded ? "0.3" : "1";
          label.style.visibility = "visible";
          label.style.transform = `translate(-50%, -50%) scale(${scale})`;
          label.dataset.occluded = occluded ? "true" : "false";
        } else {
          label.style.visibility = "hidden";
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      host.removeEventListener("mousemove", handleMouseMove);
      renderer.dispose();
      host.replaceChildren();
    };
  }, [feature, onClose]);

  if (!feature) return null;

  return (
    <div
      className={css.backdrop}
      data-testid="hero-detail-overlay"
      style={{ animationDuration: `${OPEN_MS}ms` }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={css.modal} role="dialog" aria-modal="true" aria-label={feature.title}>
        <div className={css.top}>
          <div className={css.titleGroup}>
            <span className={css.kindBadge} data-kind={feature.kind}>
              {feature.kind}
            </span>
            <p className={css.title}>{feature.title}</p>
          </div>
          <div className={css.topActions}>
            {onFreeze ? (
              <button
                type="button"
                className={css.freeze}
                data-testid="hero-freeze"
                onClick={onFreeze}
              >
                Freeze option
              </button>
            ) : null}
            <button
              type="button"
              className={css.back}
              data-testid="hero-back-to-plan"
              onClick={onClose}
            >
              Back to Plan
            </button>
          </div>
        </div>
        <div className={css.body}>
          <div className={css.canvas} ref={hostRef}>
            <span ref={labelRef} className={css.canvasLabel} data-occluded="false">
              {feature.title}
            </span>
          </div>
          <aside className={css.side}>
            <label className={css.sliderLabel}>
              <span className={css.sliderHeader}>
                Sun angle
                <span className={css.sliderValue}>{sunDeg}&deg;</span>
              </span>
              <input
                type="range"
                min={0}
                max={180}
                value={sunDeg}
                onChange={(e) => setSunDeg(Number(e.target.value))}
                aria-label="Sun angle"
              />
            </label>
            <button
              type="button"
              className={css.specsToggle}
              aria-expanded={specsOpen}
              onClick={() => setSpecsOpen((v) => !v)}
            >
              {specsOpen ? "Hide specifications" : "Specifications"}
            </button>
            {specsOpen ? (
              <dl className={css.specs}>
                {feature.width_m != null ? (
                  <>
                    <dt>Width</dt>
                    <dd>{feature.width_m.toFixed(2)} m</dd>
                  </>
                ) : null}
                {feature.depth_m != null ? (
                  <>
                    <dt>Depth</dt>
                    <dd>{feature.depth_m.toFixed(2)} m</dd>
                  </>
                ) : null}
                {feature.height_m != null ? (
                  <>
                    <dt>Height</dt>
                    <dd>{feature.height_m.toFixed(2)} m</dd>
                  </>
                ) : null}
                {feature.material ? (
                  <>
                    <dt>Material</dt>
                    <dd>{feature.material}</dd>
                  </>
                ) : null}
                {feature.qty_note ? (
                  <>
                    <dt>Quantity</dt>
                    <dd>{feature.qty_note}</dd>
                  </>
                ) : null}
                {feature.rate_note ? (
                  <>
                    <dt>Rate</dt>
                    <dd>{feature.rate_note}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

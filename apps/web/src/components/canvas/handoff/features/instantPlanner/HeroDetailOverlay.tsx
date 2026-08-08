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
    host.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xfff0e8, 0.45);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffe2c4, 1.15);
    dir.castShadow = true;
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a322e, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const mat = new THREE.MeshStandardMaterial({
      color:
        feature.kind === "planting"
          ? 0x5a7a4a
          : feature.kind === "water"
            ? 0x4a6a7a
            : 0xc4b4a4,
      roughness: 0.55,
      metalness: 0.08,
    });
    const mesh =
      feature.kind === "wall"
        ? new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.28), mat)
        : feature.kind === "planting"
          ? new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 10), mat)
          : new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.1), mat);
    mesh.position.y = feature.kind === "wall" ? 0.45 : feature.kind === "planting" ? 0.6 : 0.06;
    scene.add(mesh);

    let raf = 0;
    const tick = () => {
      const az = (sunRef.current * Math.PI) / 180;
      dir.position.set(Math.cos(az) * 3, 2.2, Math.sin(az) * 3);
      mesh.rotation.y += 0.004;
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
          <p className={css.title}>{feature.title}</p>
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
          <div className={css.canvas} ref={hostRef} />
          <aside className={css.side}>
            <label className={css.sliderLabel}>
              Sun angle
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

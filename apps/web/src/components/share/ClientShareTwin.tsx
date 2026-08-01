"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type {
  AtmospherePigment,
  DesignCanvas,
  PublicSharePayload,
} from "@workstream/contracts";
import {
  ATMOSPHERE_PIGMENT_SWATCHES,
  atmospherePigmentHex,
  isLightingSymbolId,
  sunPositionAt,
} from "@workstream/domain";
import { SharePlanSvg } from "./SharePlanSvg";
import { ArBirdseyeOverlay } from "../canvas/handoff/features/ar/ArBirdseyeOverlay";
import css from "./clientShareTwin.module.css";

const DEFAULT_LAT = -37.849;
const DEFAULT_LNG = 144.993;
const DAY_START = 6 * 60 + 20;
const DAY_END = 19 * 60 + 40;
const MIN_SHAPE_AREA_PCT = 0.01;

type Props = {
  snapshot: PublicSharePayload["snapshot"];
};

function pctToXZ(x: number, y: number): [number, number] {
  return [(x - 50) / 8, (y - 50) / 8];
}

function polygonAreaPct(
  pts: Array<{ x_pct: number; y_pct: number }>,
): number {
  let area = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x_pct * b.y_pct - b.x_pct * a.y_pct;
  }
  return Math.abs(area) * 0.5;
}

function ringShape(
  pts: Array<{ x_pct: number; y_pct: number }>,
): THREE.Shape | null {
  if (pts.length < 3) return null;
  if (
    pts.some((p) => !Number.isFinite(p.x_pct) || !Number.isFinite(p.y_pct))
  ) {
    return null;
  }
  if (polygonAreaPct(pts) < MIN_SHAPE_AREA_PCT) return null;
  const shape = new THREE.Shape();
  const [x0, z0] = pctToXZ(pts[0]!.x_pct, pts[0]!.y_pct);
  shape.moveTo(x0, -z0);
  for (let i = 1; i < pts.length; i += 1) {
    const [x, z] = pctToXZ(pts[i]!.x_pct, pts[i]!.y_pct);
    shape.lineTo(x, -z);
  }
  shape.closePath();
  return shape;
}

function formatSun(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = Math.round(min % 60);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "pm" : "am";
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function sunDateFromMin(min: number): Date {
  // Fixed mid-year Melbourne day — indicative twin, not a weather forecast.
  const d = new Date(2026, 0, 15, 0, 0, 0);
  d.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0);
  return d;
}

function initialAtmosphere(canvas: DesignCanvas | null): AtmospherePigment {
  return canvas?.presentation_pack?.atmosphere ?? "cherry";
}

function logError(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "production") return;
  console.error(message, ...args);
}

function safeColor(value: THREE.ColorRepresentation): THREE.Color {
  try {
    return new THREE.Color(value);
  } catch (err) {
    logError("Invalid colour value", value, err);
    return new THREE.Color("#5c5a56");
  }
}

function isValidGeometry(geom: THREE.BufferGeometry): boolean {
  if (!geom.attributes.position || geom.attributes.position.count === 0) {
    return false;
  }
  try {
    geom.computeBoundingBox();
    if (!geom.boundingBox) return false;
    return (
      Number.isFinite(geom.boundingBox.min.x) &&
      Number.isFinite(geom.boundingBox.max.x)
    );
  } catch {
    return false;
  }
}

function pigmentColor(pigment: AtmospherePigment): THREE.Color {
  try {
    return new THREE.Color(atmospherePigmentHex(pigment));
  } catch (err) {
    logError("Invalid atmosphere pigment", pigment, err);
    return new THREE.Color("#5c5a56");
  }
}

function safeDispose(scene?: THREE.Scene) {
  if (!scene) return;
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m?.dispose());
      } else {
        mat?.dispose();
      }
    }
  });
}

/**
 * Client digital-twin step 1 — WebGL share viewer.
 * Time-of-day scrub, lighting toggle, Atmosphere material switch.
 * Falls back to SharePlanSvg only when WebGL is unavailable.
 */
export function ClientShareTwin({ snapshot }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [webglOk, setWebglOk] = useState(true);
  const [sunMin, setSunMin] = useState(12 * 60 + 26);
  const [lightsOn, setLightsOn] = useState(true);
  const [atmosphere, setAtmosphere] = useState<AtmospherePigment>(() =>
    initialAtmosphere(snapshot.canvas),
  );
  const [arOn, setArOn] = useState(false);

  const lat = snapshot.lat ?? DEFAULT_LAT;
  const lng = snapshot.lng ?? DEFAULT_LNG;
  const canvas = snapshot.canvas;

  const lightingIds = useMemo(() => {
    const out: Array<{ x: number; y: number; id: string }> = [];
    for (const p of canvas?.placements ?? []) {
      if (isLightingSymbolId(p.symbol_id)) {
        out.push({ id: p.id, x: p.x_pct, y: p.y_pct });
      }
    }
    return out;
  }, [canvas]);

  const sceneApi = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sun: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
    ground: THREE.Mesh;
    accent: THREE.MeshStandardMaterial;
    fixtureLights: THREE.PointLight[];
    raf: number;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglOk) return;

    let disposed = false;
    let raf = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
    } catch (err) {
      logError("WebGL unavailable", err);
      setWebglOk(false);
      return;
    }

    renderer.domElement.setAttribute("data-testid", "share-twin-canvas");

    const build = (w: number, h: number) => {
      if (sceneApi.current || w === 0 || h === 0) return;
      let scene: THREE.Scene | undefined;
      try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#1a222c");

        const camera = new THREE.PerspectiveCamera(
          42,
          w / Math.max(1, h),
          0.1,
          200,
        );
        camera.position.set(6.5, 8.5, 7.5);
        camera.lookAt(0, 0.4, 0);

        renderer.setSize(w, h);

        // Ensure a single, fresh canvas in the host.
        host.replaceChildren();
        host.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xb8c4d0, 0.35);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -18;
        sun.shadow.camera.right = 18;
        sun.shadow.camera.top = 18;
        sun.shadow.camera.bottom = -18;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 60;
        sun.shadow.camera.updateProjectionMatrix();
        scene.add(sun);
        scene.add(sun.target);

        const groundMat = new THREE.MeshStandardMaterial({
          color: safeColor("#3a4038"),
          roughness: 0.92,
          metalness: 0.05,
        });
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(14, 48),
          groundMat,
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const accent = new THREE.MeshStandardMaterial({
          color: pigmentColor(atmosphere),
          roughness: 0.7,
          metalness: 0.08,
        });

        const boundary = canvas?.site_frame?.boundary ?? [];
        const bShape = ringShape(boundary);
        if (bShape) {
          try {
            const geom = new THREE.ExtrudeGeometry(bShape, {
              depth: 0.08,
              bevelEnabled: false,
            });
            if (isValidGeometry(geom)) {
              // Extrude −Z in shape space so rotateX(-π/2) lifts the mass in +Y.
              geom.translate(0, 0, -0.08);
              geom.rotateX(-Math.PI / 2);
              const mesh = new THREE.Mesh(
                geom,
                new THREE.MeshStandardMaterial({
                  color: "#d8d2c6",
                  roughness: 0.85,
                }),
              );
              mesh.receiveShadow = true;
              scene.add(mesh);
            } else {
              geom.dispose();
            }
          } catch (err) {
            logError("Boundary extrusion failed", err);
          }
        }

        const building = canvas?.site_frame?.building ?? [];
        const dShape = ringShape(building);
        if (dShape) {
          try {
            const geom = new THREE.ExtrudeGeometry(dShape, {
              depth: 1.1,
              bevelEnabled: false,
            });
            if (isValidGeometry(geom)) {
              geom.translate(0, 0, -1.1);
              geom.rotateX(-Math.PI / 2);
              const mesh = new THREE.Mesh(geom, accent);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              scene.add(mesh);
            } else {
              geom.dispose();
            }
          } catch (err) {
            logError("Building extrusion failed", err);
          }
        }

        for (const p of canvas?.placements ?? []) {
          if (
            !Number.isFinite(p.x_pct) ||
            !Number.isFinite(p.y_pct)
          ) {
            continue;
          }
          const [x, z] = pctToXZ(p.x_pct, p.y_pct);
          const isLight = isLightingSymbolId(p.symbol_id);
          try {
            const stem = new THREE.Mesh(
              new THREE.CylinderGeometry(
                isLight ? 0.06 : 0.12,
                isLight ? 0.08 : 0.18,
                isLight ? 0.55 : 0.9,
                8,
              ),
              isLight
                ? new THREE.MeshStandardMaterial({
                  color: "#f0e8a0",
                  emissive: "#c9a227",
                  emissiveIntensity: 0.35,
                })
                : new THREE.MeshStandardMaterial({
                  color: "#5a6b52",
                  roughness: 0.9,
                }),
            );
            stem.position.set(x, isLight ? 0.28 : 0.45, z);
            stem.castShadow = true;
            scene.add(stem);
          } catch (err) {
            logError("Placement mesh failed", p.id, err);
          }
        }

        const fixtureLights: THREE.PointLight[] = [];
        for (const f of lightingIds) {
          if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) continue;
          const [x, z] = pctToXZ(f.x, f.y);
          try {
            const pl = new THREE.PointLight(0xffd9a0, 0.85, 4.5, 2);
            pl.position.set(x, 0.55, z);
            scene.add(pl);
            fixtureLights.push(pl);
          } catch (err) {
            logError("Fixture light failed", f.id, err);
          }
        }

        const tick = () => {
          if (disposed) return;
          try {
            renderer.render(scene!, camera);
          } catch (err) {
            logError("Digital-twin render failed", err);
          }
          raf = window.requestAnimationFrame(tick);
          if (sceneApi.current) sceneApi.current.raf = raf;
        };
        raf = window.requestAnimationFrame(tick);

        sceneApi.current = {
          renderer,
          scene,
          camera,
          sun,
          ambient,
          ground,
          accent,
          fixtureLights,
          raf,
        };
      } catch (err) {
        logError("Digital-twin scene setup failed", err);
        safeDispose(scene);
        sceneApi.current = null;
      }
    };

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      if (!sceneApi.current) {
        build(w, h);
        return;
      }
      const { camera } = sceneApi.current;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      sceneApi.current.renderer.setSize(w, h);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      const api = sceneApi.current;
      if (api) {
        safeDispose(api.scene);
        api.renderer.domElement.remove();
        api.renderer.dispose();
        sceneApi.current = null;
      } else {
        renderer.domElement.remove();
        renderer.dispose();
      }
    };
    // Mount once per canvas identity — controls mutate via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas?.id, webglOk]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    try {
      const when = sunDateFromMin(sunMin);
      const sun = sunPositionAt(lat, lng, when);
      const elev = Math.max(2, sun.altitude_deg);
      const az = (sun.azimuth_deg * Math.PI) / 180;
      const elevR = (elev * Math.PI) / 180;
      const dist = 12;
      const x = Math.sin(az) * Math.cos(elevR) * dist;
      const y = Math.sin(elevR) * dist;
      const z = -Math.cos(az) * Math.cos(elevR) * dist;
      api.sun.position.set(x, y, z);
      api.sun.target.position.set(0, 0, 0);
      api.sun.intensity = elev < 8 ? 0.25 : elev < 20 ? 0.7 : 1.35;
      api.ambient.intensity = elev < 8 ? 0.12 : 0.35;
      api.scene.background = new THREE.Color(
        elev < 8 ? "#0c1016" : elev < 20 ? "#15202c" : "#1a222c",
      );
    } catch (err) {
      logError("Sun position update failed", err);
    }
  }, [sunMin, lat, lng]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    for (const pl of api.fixtureLights) {
      pl.visible = lightsOn;
      pl.intensity = lightsOn ? 0.85 : 0;
    }
  }, [lightsOn]);

  useEffect(() => {
    const api = sceneApi.current;
    if (!api) return;
    try {
      const next = pigmentColor(atmosphere);
      api.accent.color.copy(next);
      const wash = next.clone();
      wash.lerp(new THREE.Color("#3a4038"), 0.72);
      (api.ground.material as THREE.MeshStandardMaterial).color.copy(wash);
    } catch (err) {
      logError("Atmosphere update failed", err);
    }
  }, [atmosphere]);

  if (!webglOk) {
    return <SharePlanSvg canvas={canvas} address={snapshot.address} />;
  }

  return (
    <div className={css.wrap} data-testid="share-client-twin">
      <div
        ref={hostRef}
        className={css.viewport}
        data-testid="share-twin-viewport"
      />
      <div className={css.controls} data-testid="share-twin-controls">
        <div className={css.row}>
          <label className={css.label} htmlFor="share-sun">
            Time of day
          </label>
          <input
            id="share-sun"
            className={css.range}
            type="range"
            min={DAY_START}
            max={DAY_END}
            step={5}
            value={sunMin}
            data-testid="share-twin-sun"
            onChange={(e) => setSunMin(Number(e.target.value))}
          />
          <span className={css.mono}>{formatSun(sunMin)}</span>
        </div>
        <div className={css.row}>
          <p className={css.label}>Lighting</p>
          <button
            type="button"
            className={css.chip}
            data-on={lightsOn ? "1" : "0"}
            data-testid="share-twin-lights"
            aria-pressed={lightsOn}
            onClick={() => setLightsOn((v) => !v)}
          >
            {lightsOn ? "Fixtures on" : "Fixtures off"}
          </button>
          <span className={css.hint}>
            {lightingIds.length} fixture
            {lightingIds.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={css.row}>
          <p className={css.label}>Material</p>
          <div
            className={css.swatches}
            role="radiogroup"
            aria-label="Atmosphere palette"
            data-testid="share-twin-atmosphere"
          >
            {ATMOSPHERE_PIGMENT_SWATCHES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                className={css.swatch}
                data-atmosphere={a.id}
                data-on={atmosphere === a.id ? "1" : "0"}
                data-testid={`share-twin-atm-${a.id}`}
                aria-label={a.label}
                aria-checked={atmosphere === a.id}
                title={a.label}
                onClick={() => setAtmosphere(a.id)}
              />
            ))}
          </div>
        </div>
        <div className={css.row}>
          <p className={css.label}>AR</p>
          <button
            type="button"
            className={css.chip}
            data-testid="share-twin-ar"
            aria-pressed={arOn}
            onClick={() => setArOn(true)}
          >
            Bird&apos;s-eye overlay
          </button>
          <span className={css.hint}>Footprint occlusion</span>
        </div>
      </div>
      {arOn ? (
        <ArBirdseyeOverlay
          canvas={canvas}
          address={snapshot.address}
          onClose={() => setArOn(false)}
        />
      ) : null}
    </div>
  );
}

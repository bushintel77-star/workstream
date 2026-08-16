"use client";

/**
 * Subsurface Studio — 3D underground utilities view.
 *
 * Same Gold Standard Studio Dark chrome as Growth Studio (shared token
 * module), applied to a different real dataset: construction trenches,
 * irrigation flow, LV lighting circuit load, BYDA utility corridors, and
 * title easements. Every number on this HUD comes from the same domain
 * math the 2D board already ships (`summarizeIrrigationZones`,
 * `assessLvRuns`, `pathsCross`) — nothing here is fabricated telemetry.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ConstructionTrenchKind } from "@workstream/contracts";
import {
  DEFAULT_BOARD_WIDTH_M,
  type SubsurfaceScene,
} from "./subsurfaceStudioData";
import css from "./subsurfaceStudio.module.css";

type Props = {
  projectAddress: string;
  backHref: string;
  lat: number | null;
  lng: number | null;
  boardWidthM: number | null;
  scene: SubsurfaceScene;
};

const DEFAULT_LAT = -37.849;
const DEFAULT_LNG = 144.993;
/** Real trench depths (0.2-0.6m) read as a flat line at true scale — exaggerate for legibility. */
const DEPTH_EXAGGERATION = 6;
const MAX_FLOATING_CHIPS = 6;

const TRENCH_COLOR: Record<ConstructionTrenchKind, number> = {
  irrig_main: 0x3f6fd9,
  irrig_lateral: 0x6fa8dc,
  lighting_conduit: 0xd9a441,
  drainage: 0x7c8a7a,
};

const TRENCH_LABEL: Record<ConstructionTrenchKind, string> = {
  irrig_main: "Irrigation main",
  irrig_lateral: "Irrigation lateral",
  lighting_conduit: "Lighting conduit",
  drainage: "Drainage",
};

/** Real BYDA utility kind → ghost-volume colour (gas/water/electric convention). */
const ZONE_COLOR: Record<SubsurfaceScene["criticalZones"][number]["kind"], number> = {
  water: 0x3f6fd9,
  gas: 0xd9c341,
  power: 0xef4444,
  sewer: 0x8a6d4a,
  stormwater: 0x4a90a4,
  nbn: 0x3fae6a,
  other: 0x8a8f97,
  easement: 0x0030cf,
};

type TrenchRig = {
  line: THREE.Line;
  riser: THREE.Line;
  depthM: number;
};

function formatCoords(lat: number, lng: number): string {
  const ns = lat < 0 ? "S" : "N";
  const ew = lng < 0 ? "W" : "E";
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lng).toFixed(3)}° ${ew}`;
}

export function SubsurfaceStudioClient({
  projectAddress,
  backHref,
  lat,
  lng,
  boardWidthM,
  scene,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLDivElement>());
  const rigsRef = useRef(new Map<string, TrenchRig>());
  const autoRotateRef = useRef(true);
  const resetViewRef = useRef<() => void>(() => {});

  const [autoRotate, setAutoRotate] = useState(true);
  const maxDepthCm = useMemo(() => {
    const maxM = scene.trenches.reduce((m, t) => Math.max(m, t.depthM), 0.3);
    return Math.ceil(maxM * 100 / 5) * 5;
  }, [scene.trenches]);
  const [revealCm, setRevealCm] = useState(maxDepthCm);

  useEffect(() => {
    setRevealCm(maxDepthCm);
  }, [maxDepthCm]);

  const scaleM =
    boardWidthM != null && boardWidthM > 0 ? boardWidthM : DEFAULT_BOARD_WIDTH_M;
  const resolvedLat = lat ?? DEFAULT_LAT;
  const resolvedLng = lng ?? DEFAULT_LNG;

  const conflictCount = useMemo(
    () => scene.trenches.filter((t) => t.conflict).length,
    [scene.trenches],
  );

  const revealedTrenches = useMemo(
    () => scene.trenches.filter((t) => t.depthM * 100 <= revealCm + 0.01),
    [scene.trenches, revealCm],
  );
  const floatingTrenches = useMemo(() => {
    const conflicted = revealedTrenches.filter((t) => t.conflict);
    const rest = revealedTrenches
      .filter((t) => !t.conflict)
      .sort((a, b) => b.depthM - a.depthM);
    const budget = Math.max(0, MAX_FLOATING_CHIPS - conflicted.length);
    return [...conflicted, ...rest.slice(0, budget)];
  }, [revealedTrenches]);
  const hiddenCount = revealedTrenches.length - floatingTrenches.length;

  const hasContent =
    scene.trenches.length > 0 ||
    scene.criticalZones.length > 0 ||
    scene.irrigation.zones.length > 0 ||
    scene.lighting.aggregate.fixtureCount > 0;

  // ---- Scene setup ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hasContent) return;

    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0xf4f4f4);
    threeScene.fog = new THREE.Fog(0xf4f4f4, scaleM * 1.5, scaleM * 3.6);

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, scaleM * 24);
    const initialCamPos = new THREE.Vector3(
      scaleM * 0.55,
      scaleM * 0.5,
      scaleM * 0.7,
    );
    const initialTarget = new THREE.Vector3(0, -scaleM * 0.05, 0);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren();
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = scaleM * 0.25;
    controls.maxDistance = scaleM * 1.9;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.copy(initialTarget);
    controls.autoRotateSpeed = 0.5;

    resetViewRef.current = () => {
      camera.position.copy(initialCamPos);
      controls.target.copy(initialTarget);
      controls.update();
    };

    let interacting = false;
    controls.addEventListener("start", () => {
      interacting = true;
    });
    controls.addEventListener("end", () => {
      interacting = false;
    });

    threeScene.add(new THREE.AmbientLight(0x8fa8c2, 0.65));
    const top = new THREE.DirectionalLight(0xdfe6f0, 0.7);
    top.position.set(scaleM * 0.4, scaleM * 0.8, scaleM * 0.3);
    threeScene.add(top);

    // Ground — translucent so buried conduit reads through it.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(scaleM * 0.85, 72),
      new THREE.MeshStandardMaterial({
        color: 0x161a1e,
        roughness: 0.9,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    threeScene.add(ground);

    const grid = new THREE.GridHelper(scaleM * 1.6, 16, 0x2a332c, 0x1c2420);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    threeScene.add(grid);

    // Critical zones — flat translucent footprints, real utility-kind colour.
    for (const zone of scene.criticalZones) {
      if (zone.points.length < 3) continue;
      const shape = new THREE.Shape(
        zone.points.map(
          (p) =>
            new THREE.Vector2(
              (p.xPct / 100 - 0.5) * scaleM,
              (p.yPct / 100 - 0.5) * scaleM,
            ),
        ),
      );
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: ZONE_COLOR[zone.kind],
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.015;
      threeScene.add(mesh);
    }

    // Trenches — polyline at real (exaggerated) depth + a riser to the surface.
    const rigs = new Map<string, TrenchRig>();
    for (const t of scene.trenches) {
      const color = new THREE.Color(
        t.conflict ? 0xef4444 : TRENCH_COLOR[t.kind],
      );
      const depthWorld = -t.depthM * DEPTH_EXAGGERATION;
      const pts = t.points.map(
        (p) =>
          new THREE.Vector3(
            (p.xPct / 100 - 0.5) * scaleM,
            depthWorld,
            (p.yPct / 100 - 0.5) * scaleM,
          ),
      );
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, linewidth: 2 }),
      );
      threeScene.add(line);

      const first = pts[0]!;
      const riser = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          first,
          new THREE.Vector3(first.x, 0, first.z),
        ]),
        new THREE.LineDashedMaterial({
          color,
          dashSize: 0.15,
          gapSize: 0.1,
          transparent: true,
          opacity: 0.6,
        }),
      );
      riser.computeLineDistances();
      threeScene.add(riser);

      rigs.set(t.id, { line, riser, depthM: t.depthM });
    }
    rigsRef.current = rigs;

    let raf = 0;
    const worldPos = new THREE.Vector3();
    const tick = () => {
      controls.autoRotate = autoRotateRef.current && !interacting;
      controls.update();

      for (const [id, rig] of rigsRef.current) {
        const el = chipRefs.current.get(id);
        if (!el) continue;
        rig.line.geometry.computeBoundingSphere();
        const center = rig.line.geometry.boundingSphere?.center;
        if (!center) continue;
        worldPos.copy(center);
        const proj = worldPos.clone().project(camera);
        if (proj.z < -1 || proj.z > 1) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.left = `${((proj.x + 1) / 2) * 100}%`;
        el.style.top = `${((1 - proj.y) / 2) * 100}%`;
        el.style.visibility = "visible";
      }

      renderer.render(threeScene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const nw = host.clientWidth || w;
      const nh = host.clientHeight || h;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [scene, scaleM, hasContent]);

  // ---- Apply depth-reveal scrub to live rigs ----
  useEffect(() => {
    for (const rig of rigsRef.current.values()) {
      const revealed = rig.depthM * 100 <= revealCm + 0.01;
      rig.line.visible = revealed;
      rig.riser.visible = revealed;
    }
  }, [revealCm]);

  const irrigLMin = scene.irrigation.totalFlowLph / 60;

  return (
    <div className={css.root} data-testid="subsurface-studio-root">
      <div
        ref={hostRef}
        className={css.canvasHost}
        data-testid="subsurface-studio-canvas-host"
      />
      <div className={css.vignette} />

      {!hasContent ? (
        <div className={css.emptyState}>
          <div className={css.emptyCard}>
            <p className={css.emptyTitle}>No subsurface systems drawn yet</p>
            <p className={css.emptyBody}>
              This view reads real construction trenches, irrigation zones and
              LV lighting circuits from the design canvas — draw irrigation,
              lighting or auto-trench runs there first, then come back to see
              them underground.
            </p>
            <a className={css.emptyCta} href={backHref}>
              Open design canvas
            </a>
          </div>
        </div>
      ) : null}

      <div className={css.topBar}>
        <div className={css.brandCard}>
          <p className={css.brandKicker}>Workstream landscape studio</p>
          <p className={css.brandTitle}>Subsurface systems</p>
          <p className={css.brandSub}>{projectAddress}</p>
        </div>
        <a className={css.backLink} href={backHref}>
          ← Back to canvas
        </a>
      </div>

      {hasContent ? (
        <div className={css.rail}>
          <button
            type="button"
            className={css.railBtn}
            data-active={autoRotate ? "true" : "false"}
            aria-label={autoRotate ? "Pause orbit" : "Resume orbit"}
            onClick={() => setAutoRotate((v) => !v)}
          >
            {autoRotate ? "⏸" : "⟳"}
          </button>
          <button
            type="button"
            className={css.railBtn}
            aria-label="Reset view"
            onClick={() => resetViewRef.current()}
          >
            ⤾
          </button>
        </div>
      ) : null}

      {hasContent ? (
        <div className={css.systemsLayer}>
          <div className={css.systemCard} data-system="hydrological">
            <p className={css.systemKicker}>
              <span className={css.systemDot} />
              Hydrological system
            </p>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Main flow</span>
              <span className={css.systemValue}>{irrigLMin.toFixed(1)} L/min</span>
            </div>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Valves</span>
              <span className={css.systemValue}>{scene.irrigation.valveCount}</span>
            </div>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Zones</span>
              <span className={css.systemValue}>{scene.irrigation.zones.length}</span>
            </div>
          </div>
          <div className={css.systemCard} data-system="lighting">
            <p className={css.systemKicker}>
              <span className={css.systemDot} />
              LV lighting circuit
            </p>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Connected load</span>
              <span className={css.systemValue}>
                {scene.lighting.aggregate.connectedWatts.toFixed(0)} W
              </span>
            </div>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Voltage drop</span>
              <span
                className={css.systemValue}
                data-tone={scene.lighting.aggregate.dropWarn ? "conflict" : undefined}
              >
                {scene.lighting.aggregate.voltageDropPct.toFixed(1)}%
              </span>
            </div>
            <div className={css.systemRow}>
              <span className={css.systemLabel}>Transformer load</span>
              <span
                className={css.systemValue}
                data-tone={scene.lighting.aggregate.overloaded ? "conflict" : undefined}
              >
                {Math.round(scene.lighting.aggregate.loadFraction * 100)}%
              </span>
            </div>
            <p className={css.systemNote}>{scene.lighting.aggregate.tip}</p>
          </div>
        </div>
      ) : null}

      <div className={css.markerLayer}>
        {floatingTrenches.map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              if (el) chipRefs.current.set(t.id, el);
              else chipRefs.current.delete(t.id);
            }}
            className={css.trenchChip}
            data-conflict={t.conflict ? "true" : "false"}
            data-testid={`subsurface-trench-chip-${t.id}`}
          >
            <div className={css.trenchHead}>
              <span className={css.trenchDot} />
              <p className={css.trenchName}>{TRENCH_LABEL[t.kind]}</p>
            </div>
            <p className={css.trenchMeta}>
              Depth: {(t.depthM * 100).toFixed(0)} cm
            </p>
            {t.conflict ? (
              <span className={css.conflictBadge}>Crosses located utility</span>
            ) : null}
          </div>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className={css.foot}>+{hiddenCount} more runs in view</p>
      ) : null}

      {hasContent ? (
        <div className={css.dock} data-testid="subsurface-studio-dock">
          <div className={css.dockHead}>
            <div>
              <p className={css.dockKicker}>Depth reveal</p>
              <p className={css.dockTitle}>
                {projectAddress.split(",")[0] ?? "Subsurface"}
              </p>
            </div>
            <div>
              <p className={css.dockReadout}>{revealCm} cm</p>
              <p className={css.dockReadoutSub}>Cutaway depth</p>
            </div>
          </div>
          <input
            type="range"
            className={css.scrubTrack}
            min={0}
            max={maxDepthCm}
            step={5}
            value={revealCm}
            aria-label="Cutaway depth"
            data-testid="subsurface-studio-scrubber"
            onChange={(e) => setRevealCm(Number(e.currentTarget.value))}
          />
          {conflictCount > 0 ? (
            <p
              className={css.conflictFoot}
              data-testid="subsurface-conflict-summary"
              aria-live="polite"
            >
              {conflictCount} trench{conflictCount === 1 ? "" : "es"} cross a
              located utility or easement — confirm-locate before machine dig
            </p>
          ) : (
            <p className={css.foot}>
              {scene.trenches.length} trench run
              {scene.trenches.length === 1 ? "" : "s"} · indicative depth from
              the design canvas
            </p>
          )}
        </div>
      ) : null}

      <div className={css.statusRail}>
        <p className={css.statusCoords}>
          SITE TRUTH // {formatCoords(resolvedLat, resolvedLng)}
        </p>
        <p className={css.statusNote}>
          {scene.criticalZones.length} located utility / easement corridor
          {scene.criticalZones.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

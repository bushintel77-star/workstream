"use client";

/**
 * Growth Studio — 3D temporal growth simulation.
 *
 * New front end: dark charcoal + glass-HUD chrome, entirely separate from the
 * `handoff` studio's blush-frost design system. The *logic* underneath is not
 * new — growth-stage scaling, root/canopy crowding, sun position, and the
 * plant catalogue are the same domain functions the 2D board findings use.
 * This view is a different lens on that data, not a reinvention of it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { sunPositionAt, TEMPORAL_ROOT_TO_CANOPY, growthStageSpreadFactor } from "@workstream/domain";
import {
  GROWTH_TEMPORAL_STAGES,
  growthStageFromIndex,
  growthStageIndex,
  growthStageLabel,
} from "../handoff/features/sunGrowth/growthTemporal";
import { sunDateFromPreset } from "../handoff/features/sunGrowth/sunDatePreset";
import {
  buildGrowthConflicts,
  DEFAULT_BOARD_WIDTH_M,
  type GrowthPlantInstance,
  type GrowthStageId,
} from "./growthStudioData";
import css from "./growthStudio.module.css";

type Props = {
  projectAddress: string;
  backHref: string;
  lat: number | null;
  lng: number | null;
  boardWidthM: number | null;
  instances: GrowthPlantInstance[];
};

const STAGE_WORD: Record<GrowthStageId, string> = {
  plant: "Survey baseline",
  "5yr": "Establishing",
  mature: "Maturity",
};

/** Prahran demo fallback — same default as the 2D sun/growth dock. */
const DEFAULT_LAT = -37.849;
const DEFAULT_LNG = 144.993;
const NOON_MIN = 12 * 60;
const MAX_FLOATING_LABELS = 6;

type InstanceRig = {
  group: THREE.Group;
  canopy: THREE.Group;
  trunk: THREE.Mesh;
  rootDisc: THREE.Mesh;
  anchor: THREE.Object3D;
  trunkHeightM: number;
  matureCanopyRM: number;
  existing: boolean;
};

/** Deterministic species hue so the same tree always renders the same colour. */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 92 + (h % 46); // 92..138: green → olive band
}

/** "37.849° S, 144.993° E" — real project coordinates, status-rail style. */
function formatCoords(lat: number, lng: number): string {
  const ns = lat < 0 ? "S" : "N";
  const ew = lng < 0 ? "W" : "E";
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lng).toFixed(3)}° ${ew}`;
}

export function GrowthStudioClient({
  projectAddress,
  backHref,
  lat,
  lng,
  boardWidthM,
  instances,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const rigsRef = useRef(new Map<string, InstanceRig>());
  const autoRotateRef = useRef(true);
  const resetViewRef = useRef<() => void>(() => {});

  const [growth, setGrowth] = useState<GrowthStageId>("mature");
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  autoRotateRef.current = autoRotate;

  const scaleM =
    boardWidthM != null && boardWidthM > 0 ? boardWidthM : DEFAULT_BOARD_WIDTH_M;
  const resolvedLat = lat ?? DEFAULT_LAT;
  const resolvedLng = lng ?? DEFAULT_LNG;

  const conflicts = useMemo(
    () => buildGrowthConflicts(instances, growth, boardWidthM),
    [instances, growth, boardWidthM],
  );
  const conflictById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of conflicts) m.set(c.id, c.crowded);
    return m;
  }, [conflicts]);
  const conflictCount = useMemo(
    () => conflicts.filter((c) => c.crowded).length,
    [conflicts],
  );

  /**
   * Indicative canopy coverage at the current stage — real geometry (sum of
   * canopy circle areas over site area), not a fabricated figure. Overlaps
   * aren't subtracted, so this reads as an upper-bound estimate, same spirit
   * as the 2D board's other "indicative" callouts.
   */
  const canopyCoveragePct = useMemo(() => {
    const siteAreaM2 = scaleM * scaleM;
    if (!(siteAreaM2 > 0)) return 0;
    const totalCanopyM2 = instances.reduce((sum, it) => {
      const factor = it.existing ? 1 : growthStageSpreadFactor(growth);
      const radiusM = (it.matureSpreadM / 2) * factor;
      return sum + Math.PI * radiusM * radiusM;
    }, 0);
    return Math.min(100, Math.round((totalCanopyM2 / siteAreaM2) * 100));
  }, [instances, growth, scaleM]);

  const stageIdx = growthStageIndex(growth);

  const floatingInstances = useMemo(() => {
    const conflicted = instances.filter((it) => conflictById.get(it.id));
    const rest = instances
      .filter((it) => !conflictById.get(it.id))
      .sort((a, b) => b.matureSpreadM - a.matureSpreadM);
    const budget = Math.max(0, MAX_FLOATING_LABELS - conflicted.length);
    return [...conflicted, ...rest.slice(0, budget)];
  }, [instances, conflictById]);
  const hiddenCount = instances.length - floatingInstances.length;

  // ---- Scene setup — runs once per instance list / scale ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host || instances.length === 0) return;

    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f4);
    scene.fog = new THREE.Fog(0xf4f4f4, scaleM * 1.5, scaleM * 3.4);

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, scaleM * 24);
    const initialCamPos = new THREE.Vector3(
      scaleM * 0.5,
      scaleM * 0.42,
      scaleM * 0.62,
    );
    const initialTarget = new THREE.Vector3(0, scaleM * 0.05, 0);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    // Three r185 deprecated PCFSoftShadowMap (silently downgrades + warns) —
    // use the resulting type directly.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren();
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = scaleM * 0.25;
    controls.maxDistance = scaleM * 1.8;
    controls.maxPolarAngle = Math.PI * 0.49;
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

    // ---- Lighting: real sun position at solar noon, project coordinates ----
    const amb = new THREE.AmbientLight(0xaebfd0, 0.55);
    scene.add(amb);
    const sky = new THREE.HemisphereLight(0x8fa8c2, 0x1a1f16, 0.55);
    scene.add(sky);

    const sunLight = new THREE.DirectionalLight(0xfff2df, 1.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = scaleM * 3;
    const shadowExtent = scaleM * 0.9;
    sunLight.shadow.camera.left = -shadowExtent;
    sunLight.shadow.camera.right = shadowExtent;
    sunLight.shadow.camera.top = shadowExtent;
    sunLight.shadow.camera.bottom = -shadowExtent;
    sunLight.shadow.bias = -0.0006;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const when = sunDateFromPreset("today", NOON_MIN);
    const sunPos = sunPositionAt(resolvedLat, resolvedLng, when);
    const altRad = (Math.max(sunPos.altitude_deg, 6) * Math.PI) / 180;
    const azRad = (sunPos.azimuth_deg * Math.PI) / 180;
    const sunDist = scaleM * 2.2;
    sunLight.position.set(
      Math.cos(altRad) * Math.sin(azRad) * sunDist,
      Math.sin(altRad) * sunDist,
      -Math.cos(altRad) * Math.cos(azRad) * sunDist,
    );

    // ---- Ground ----
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(scaleM * 0.85, 72),
      new THREE.MeshStandardMaterial({
        color: 0x161f18,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(scaleM * 1.6, 16, 0x2a332c, 0x1c2420);
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.35;
    scene.add(grid);

    // ---- Plant rigs ----
    const rigs = new Map<string, InstanceRig>();
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3d2e,
      roughness: 0.95,
    });
    const lobeOffsets: Array<[number, number, number, number]> = [
      [0, 0, 0, 1],
      [0.32, 0.08, 0.18, 0.68],
      [-0.28, -0.04, -0.2, 0.62],
      [0.05, 0.22, -0.28, 0.58],
    ];

    for (const inst of instances) {
      const worldX = (inst.xPct / 100 - 0.5) * scaleM;
      const worldZ = (inst.yPct / 100 - 0.5) * scaleM;
      const group = new THREE.Group();
      group.position.set(worldX, 0, worldZ);

      const matureCanopyRM = Math.max(0.35, inst.matureSpreadM / 2);
      const matureHeightM = Math.max(0.6, inst.matureHeightM);
      const trunkHeightM = matureHeightM * 0.42;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(
          Math.max(0.04, matureCanopyRM * 0.05),
          Math.max(0.06, matureCanopyRM * 0.08),
          trunkHeightM,
          8,
        ),
        trunkMat,
      );
      trunk.castShadow = true;
      group.add(trunk);

      const hue = hashHue(inst.botanicalName ?? inst.label);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(
          `hsl(${hue}, ${inst.existing ? 22 : 42}%, ${inst.existing ? 30 : 34}%)`,
        ),
        roughness: 0.78,
        metalness: 0.04,
      });
      const canopy = new THREE.Group();
      for (const [ox, oy, oz, s] of lobeOffsets) {
        const lobe = new THREE.Mesh(
          new THREE.IcosahedronGeometry(matureCanopyRM, 1),
          canopyMat,
        );
        lobe.position.set(
          ox * matureCanopyRM,
          oy * matureCanopyRM,
          oz * matureCanopyRM,
        );
        lobe.scale.setScalar(s);
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        canopy.add(lobe);
      }
      const anchor = new THREE.Object3D();
      anchor.position.set(0, matureCanopyRM * 1.05, 0);
      canopy.add(anchor);
      group.add(canopy);

      const rootDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 40),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      rootDisc.rotation.x = -Math.PI / 2;
      rootDisc.position.y = 0.02;
      rootDisc.visible = false;
      group.add(rootDisc);

      scene.add(group);
      rigs.set(inst.id, {
        group,
        canopy,
        trunk,
        rootDisc,
        anchor,
        trunkHeightM,
        matureCanopyRM,
        existing: inst.existing,
      });
    }
    rigsRef.current = rigs;

    let raf = 0;
    const worldPos = new THREE.Vector3();
    const tick = () => {
      controls.autoRotate = autoRotateRef.current && !interacting;
      controls.update();

      for (const [id, rig] of rigsRef.current) {
        const el = labelRefs.current.get(id);
        if (!el) continue;
        rig.anchor.getWorldPosition(worldPos);
        const proj = worldPos.clone().project(camera);
        if (proj.z < -1 || proj.z > 1) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.left = `${((proj.x + 1) / 2) * 100}%`;
        el.style.top = `${((1 - proj.y) / 2) * 100}%`;
        el.style.visibility = "visible";
      }

      renderer.render(scene, camera);
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
      trunkMat.dispose();
      host.replaceChildren();
    };
  }, [instances, scaleM, lat, lng, resolvedLat, resolvedLng]);

  // ---- Apply growth-stage scaling + conflict state to live rigs ----
  useEffect(() => {
    const rigs = rigsRef.current;
    if (rigs.size === 0) return;
    const factor = growthStageSpreadFactor(growth);
    for (const [id, rig] of rigs) {
      const stageFactor = rig.existing ? 1 : factor;
      rig.canopy.scale.setScalar(stageFactor);
      rig.trunk.scale.y = Math.max(0.35, stageFactor);
      rig.trunk.position.y = (rig.trunkHeightM * rig.trunk.scale.y) / 2;
      rig.canopy.position.y = rig.trunkHeightM * rig.trunk.scale.y;

      const crowded = conflictById.get(id) === true;
      const rootRadiusM = rig.matureCanopyRM * TEMPORAL_ROOT_TO_CANOPY * stageFactor;
      rig.rootDisc.scale.setScalar(Math.max(0.01, rootRadiusM));
      rig.rootDisc.visible = crowded;
    }
  }, [growth, conflictById]);

  return (
    <div className={css.root} data-testid="growth-studio-root">
      <div
        ref={hostRef}
        className={css.canvasHost}
        data-testid="growth-studio-canvas-host"
      />
      <div className={css.vignette} />

      {instances.length === 0 ? (
        <div className={css.emptyState}>
          <div className={css.emptyCard}>
            <p className={css.emptyTitle}>No planting on this board yet</p>
            <p className={css.emptyBody}>
              This simulation reads real placements and real catalogue mature
              sizes — place canopy trees, hedges or feature planting on the
              design canvas first, then come back to see them grow.
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
          <p className={css.brandTitle}>10-year growth simulation</p>
          <p className={css.brandSub}>{projectAddress}</p>
        </div>
        <a className={css.backLink} href={backHref}>
          ← Back to canvas
        </a>
      </div>

      {instances.length > 0 ? (
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

      {instances.length > 0 ? (
        <div className={css.impactCard} data-testid="growth-studio-impact-card">
          <p className={css.impactKicker}>Environmental impact</p>
          <div className={css.impactRow}>
            <span className={css.impactLabel}>Canopy coverage</span>
            <span className={css.impactValue}>≈{canopyCoveragePct}%</span>
          </div>
          <div className={css.impactTrack}>
            <div
              className={css.impactFill}
              style={{ width: `${Math.min(100, canopyCoveragePct)}%` }}
            />
          </div>
          <div className={css.impactRow}>
            <span className={css.impactLabel}>Root conflicts</span>
            <span
              className={css.impactValue}
              data-tone={conflictCount > 0 ? "conflict" : undefined}
            >
              {conflictCount}
            </span>
          </div>
          <div className={css.impactTrack}>
            <div
              className={css.impactFill}
              data-tone={conflictCount > 0 ? "conflict" : undefined}
              style={{
                width: `${Math.min(100, (conflictCount / Math.max(1, instances.length)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className={css.speciesLayer}>
        {floatingInstances.map((inst) => {
          const crowded = conflictById.get(inst.id) === true;
          const factor = inst.existing ? 1 : growthStageSpreadFactor(growth);
          const reachM = (inst.matureSpreadM / 2) * factor;
          const pct = Math.round(factor * 100);
          return (
            <div
              key={inst.id}
              ref={(el) => {
                if (el) labelRefs.current.set(inst.id, el);
                else labelRefs.current.delete(inst.id);
              }}
              className={css.speciesChip}
              data-conflict={crowded ? "true" : "false"}
              data-existing={inst.existing ? "true" : "false"}
              data-testid={`growth-species-chip-${inst.id}`}
            >
              <div className={css.speciesHead}>
                <span className={css.speciesDot} />
                <p className={css.speciesName}>
                  {inst.botanicalName ?? inst.label}
                </p>
              </div>
              <p className={css.speciesMeta}>
                R: {reachM.toFixed(1)}m · {inst.existing ? "fixed" : `${pct}% mature`}
              </p>
              {crowded ? (
                <span className={css.conflictBadge}>Root conflict detected</span>
              ) : inst.existing ? (
                <span className={css.existingBadge}>Site truth</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <p className={css.moreChip}>+{hiddenCount} more species in view</p>
      ) : null}

      {instances.length > 0 ? (
        <div className={css.dock} data-testid="growth-studio-dock">
          <div className={css.dockHead}>
            <div>
              <p className={css.dockKicker}>Temporal growth sim</p>
              <p className={css.dockTitle}>
                {projectAddress.split(",")[0] ?? "Growth timeline"}
              </p>
            </div>
            <div>
              <p className={css.dockReadout}>
                {growthStageLabel(growth).replace("Year ", "Yr ")}
              </p>
              <p className={css.dockReadoutSub}>{STAGE_WORD[growth]}</p>
            </div>
          </div>
          <div className={css.transport}>
            <button
              type="button"
              className={css.transportBtn}
              onClick={() => {
                setPlaying(false);
                setGrowth(growthStageFromIndex(stageIdx - 1));
              }}
              aria-label="Previous stage"
              disabled={stageIdx === 0}
            >
              ◀
            </button>
            <button
              type="button"
              className={css.transportBtn}
              data-active={playing ? "true" : "false"}
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className={css.transportBtn}
              onClick={() => {
                setPlaying(false);
                setGrowth(growthStageFromIndex(stageIdx + 1));
              }}
              aria-label="Next stage"
              disabled={stageIdx === GROWTH_TEMPORAL_STAGES.length - 1}
            >
              ▶
            </button>
            <input
              type="range"
              className={css.scrubTrack}
              min={0}
              max={GROWTH_TEMPORAL_STAGES.length - 1}
              step={1}
              value={stageIdx}
              aria-label="Growth stage"
              data-testid="growth-studio-scrubber"
              onChange={(e) => {
                setPlaying(false);
                setGrowth(growthStageFromIndex(Number(e.currentTarget.value)));
              }}
            />
          </div>
          <div className={css.steps}>
            {GROWTH_TEMPORAL_STAGES.map((s) => (
              <span
                key={s.id}
                className={css.stepLabel}
                data-active={growth === s.id ? "true" : "false"}
              >
                {s.label}
              </span>
            ))}
          </div>
          {conflictCount > 0 ? (
            <p
              className={css.conflictFoot}
              data-testid="growth-studio-conflict-summary"
              aria-live="polite"
            >
              {conflictCount} root conflict{conflictCount === 1 ? "" : "s"} at{" "}
              {growthStageLabel(growth)} — space before you plant
            </p>
          ) : (
            <p className={css.foot}>
              {instances.length} species tracked · indicative growth from
              catalogue mature sizes
            </p>
          )}
        </div>
      ) : null}

      <div className={css.statusRail}>
        <p className={css.statusCoords}>
          SITE TRUTH // {formatCoords(resolvedLat, resolvedLng)}
        </p>
        <p className={css.statusNote}>
          {instances.length} species · indicative growth from catalogue sizes
        </p>
      </div>
    </div>
  );
}

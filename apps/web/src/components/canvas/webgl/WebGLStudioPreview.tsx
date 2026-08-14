"use client";

/**
 * Gold Standard 2026 — Unified WebGL Studio (Fused Rendering Context).
 *
 * The primary operator surface. Mounts the WebGLStudio with ALL canvas data
 * wired: boundary, building, easements, items, strokes, subsurface utilities
 * (from BYDA assets), strike alerts (from trench×utility intersection),
 * terrain heightmap (from spot levels), and the aerial underlay.
 *
 * This is no longer a "dev-only preview" — it is the default mount. The legacy
 * SVG studio (HandoffDesignStudio) is the ?svg=1 fallback.
 *
 * Key fused-rendering features:
 *   - View toggle: Plan ↔ 3D drives viewBlendTarget in the store. The
 *     FusedCamera interpolates the projection matrix — no hard cut.
 *   - Shared ink: strokes hydrate from the canvas and render in BOTH views
 *     via the FusedSketchLayer.
 *   - Autosave: the useStudioAutosave hook persists strokes back to the API.
 *   - Live data: sample utilities replaced by real BYDA/trench/level data.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CanvasStroke,
  CatalogPlacement,
  ConstructionTrench,
  DesignBydaAsset,
  DesignSiteFrameLevel,
  IrrigationZone,
} from "@workstream/contracts";
import { GlassCard } from "./GlassCard";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useStudioStore,
  seasonLabel,
  seasonMonth,
  leafStatus,
} from "./studioStore";
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";

/** Day arc bounds — same as the 2D SunGrowthDock (~06:20 → ~19:40). */
const DAY_START = 6 * 60 + 20;
const DAY_END = 19 * 60 + 40;

// R3F Canvas requires the browser — dynamic import with ssr:false
const WebGLStudio = dynamic(() => import("./WebGLStudio").then((m) => m.WebGLStudio), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, background: "var(--gs-canvas)" }} />
  ),
});

export interface WebGLStudioPreviewProps {
  projectId: string;
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  items?: RenderItem[];
  /** Project latitude (decimal degrees). Defaults to Prahran demo. */
  lat?: number;
  lng?: number;
  /** Persisted canvas strokes (hydrated into the store on mount). */
  initialStrokes?: CanvasStroke[];
  /** Persisted placements (for autosave). */
  placements?: CatalogPlacement[];
  /** BYDA assets from site_frame → converted to subsurface utilities. */
  bydaAssets?: DesignBydaAsset[];
  /** Construction trenches → converted to excavations for strike detection. */
  constructionTrenches?: ConstructionTrench[];
  /** Irrigation zones → feed hydraulic calculations. */
  irrigationZones?: IrrigationZone[];
  /** Spot levels from site_frame → feed terrain heightmap. */
  levels?: DesignSiteFrameLevel[];
  /** Aerial photo URI (for the ground underlay texture). */
  aerialUri?: string | null;
  /** Activate sketch mode on mount (from ?tool=sketch deep link). */
  initialSketchMode?: boolean;
}

export function WebGLStudioPreview({
  projectId,
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  items,
  lat,
  lng,
  initialStrokes,
  placements = [],
  bydaAssets = [],
  constructionTrenches = [],
  irrigationZones = [],
  levels = [],
  aerialUri = null,
  initialSketchMode = false,
}: WebGLStudioPreviewProps) {
  const [rig, setRig] = useState<StudioCameraRig>(DEFAULT_CAMERA_RIG);
  const [presentationMode, setPresentationMode] = useState(false);

  // --- Store subscriptions (DOM HUD re-renders; 3D reads via getState) ---
  const year = useStudioStore((s) => s.growthYear);
  const setYear = useStudioStore((s) => s.setGrowthYear);
  const growthFactor = year / 10;
  const sunMin = useStudioStore((s) => s.sunMin);
  const setSunMin = useStudioStore((s) => s.setSunMin);
  const seasonProgress = useStudioStore((s) => s.seasonProgress);
  const setSeasonProgress = useStudioStore((s) => s.setSeasonProgress);
  const subsurfaceView = useStudioStore((s) => s.subsurfaceView);
  const setSubsurfaceView = useStudioStore((s) => s.setSubsurfaceView);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const setSketchMode = useStudioStore((s) => s.setSketchMode);
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);
  const setViewBlendTarget = useStudioStore((s) => s.setViewBlendTarget);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const saveStatus = useStudioStore((s) => s.saveStatus);

  // --- Hydrate the store on mount (strokes + project context) ---
  // This runs once when the component mounts with the server-fetched data.
  const hydratedRef = useState({ done: false });
  useEffect(() => {
    if (hydratedRef[0].done) return;
    hydratedRef[0].done = true;
    const store = useStudioStore.getState();
    store.setSketchStrokes(initialStrokes ?? []);
    store.setProjectContext(projectId, aerialUri);
    if (initialSketchMode) store.setSketchMode(true);
  }, [initialStrokes, projectId, aerialUri, initialSketchMode, hydratedRef]);

  // --- Compute live studio data (replaces hardcoded sample utilities) ---
  const liveData = useMemo(
    () =>
      computeLiveStudioData({
        bydaAssets,
        trenches: constructionTrenches,
        irrigationZones,
        levels,
        scaleM,
        boardAspect,
      }),
    [bydaAssets, constructionTrenches, irrigationZones, levels, scaleM, boardAspect],
  );

  // --- Autosave (debounced + retry + backoff) ---
  const autosaveDoc = useMemo(
    () => ({ placements, strokes }),
    [placements, strokes],
  );
  useStudioAutosave(projectId, autosaveDoc);
  useBeforeUnloadGuard();

  const stats = useMemo(
    () => ({
      boundaryPoints: boundaryPct.length,
      buildingPoints: buildingPct?.length ?? 0,
      easements: easementsPct?.length ?? 0,
      items: items?.length ?? 0,
      strokes: strokes.length,
      utilities: liveData.subsurfaceUtilities.length,
      strikes: liveData.strikeAlerts.length,
      scaleM,
      tilt: rig.tiltDeg,
    }),
    [boundaryPct, buildingPct, easementsPct, items, strokes, liveData, scaleM, rig.tiltDeg],
  );

  const is3D = viewBlendTarget > 0.5;

  return (
    <WebGLStudio
      scaleM={scaleM}
      boardAspect={boardAspect}
      boundaryPct={boundaryPct}
      buildingPct={buildingPct}
      easementsPct={easementsPct}
      items={items}
      cameraRig={rig}
      onRigChange={setRig}
      subsurfaceUtilities={liveData.subsurfaceUtilities}
      strikeAlerts={liveData.strikeAlerts}
      lens={presentationMode ? PRESENTATION_LENS : TECHNICAL_LENS}
      growthFactor={growthFactor}
      lat={lat}
      lng={lng}
      sunMin={sunMin}
      aerialUri={aerialUri}
      heightmapPoints={liveData.heightmapPoints}
    >
      {/* ---- Top-left: scene stats + view toggle ---- */}
      <GlassCard position="top-left" style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 13, color: "var(--gs-ink)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Studio</div>
          <div style={{ color: "var(--gs-ink-secondary)", lineHeight: 1.5 }}>
            Boundary: {stats.boundaryPoints} pts | Items: {stats.items}<br />
            Strokes: {stats.strokes} | Utilities: {stats.utilities}
            {stats.strikes > 0 && (
              <span style={{ color: "var(--gs-conflict)" }}> | ⚠ {stats.strikes} strikes</span>
            )}<br />
            Scale: {stats.scaleM.toFixed(0)}m | Save: {saveStatus}
          </div>

          {/* View toggle — Plan ↔ 3D (drives the fused camera) */}
          <div
            style={{
              display: "flex",
              marginTop: 8,
              borderRadius: 8,
              border: "1px solid var(--gs-line)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewBlendTarget(0)}
              style={{
                flex: 1,
                padding: "6px 14px",
                border: "none",
                background: !is3D ? "var(--gs-primary)" : "transparent",
                color: !is3D ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              Plan
            </button>
            <button
              onClick={() => setViewBlendTarget(1)}
              style={{
                flex: 1,
                padding: "6px 14px",
                border: "none",
                background: is3D ? "var(--gs-primary)" : "transparent",
                color: is3D ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              3D
            </button>
          </div>

          {/* Layer toggles */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            <ToggleChip
              active={presentationMode}
              onClick={() => setPresentationMode((p) => !p)}
              activeColor="var(--gs-primary)"
            >
              {presentationMode ? "▾ Technical" : "▸ Present"}
            </ToggleChip>
            <ToggleChip
              active={subsurfaceView}
              onClick={() => setSubsurfaceView(!subsurfaceView)}
              activeColor="var(--gs-truth)"
            >
              {subsurfaceView ? "▾ Physical" : "▸ Underground"}
            </ToggleChip>
            <ToggleChip
              active={sketchMode}
              onClick={() => setSketchMode(!sketchMode)}
              activeColor="var(--gs-primary)"
            >
              {sketchMode ? "▾ Orbit" : "▸ Sketch"}
            </ToggleChip>
          </div>
        </div>
      </GlassCard>

      {/* ---- Bottom-center: growth timeline scrubber ---- */}
      <GlassCard
        position={{ bottom: 24, left: "50%", transform: "translateX(-50%)" }}
        style={{ width: "min(80%, 48rem)", padding: "16px 20px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <span style={scrubberLabelStyle}>Growth Simulation</span>
          <span style={scrubberValueStyle}>Year {year}</span>
        </div>
        <ScrubberTrack
          value={growthFactor}
          min={0}
          max={10}
          step={1}
          onChange={setYear}
          ariaLabel="Growth simulation year"
          labels={["Year 0", "Year 5", "Year 10"]}
          highlightValues={[0, 5, 10]}
          currentHighlight={year}
        />
      </GlassCard>

      {/* ---- Top-center: sun position scrubber ---- */}
      <GlassCard
        position={{ top: 16, left: "50%", transform: "translateX(-50%)" }}
        style={{ width: "min(64%, 38rem)", padding: "12px 18px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span style={scrubberLabelStyle}>Sun · Real Shadows</span>
          <span style={{ ...scrubberValueStyle, fontSize: 20 }}>
            {String(Math.floor(sunMin / 60)).padStart(2, "0")}:
            {String(sunMin % 60).padStart(2, "0")}
          </span>
        </div>
        <ScrubberTrack
          value={(sunMin - DAY_START) / (DAY_END - DAY_START)}
          min={DAY_START}
          max={DAY_END}
          step={5}
          onChange={setSunMin}
          ariaLabel="Time of day"
          labels={["06:20", "13:00", "19:40"]}
        />
      </GlassCard>

      {/* ---- Top-center offset: season scrubber ---- */}
      <GlassCard
        position={{ top: 80, left: "50%", transform: "translateX(-50%)" }}
        style={{ width: "min(64%, 38rem)", padding: "12px 18px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span style={scrubberLabelStyle}>Season · {seasonLabel(seasonProgress)}</span>
          <span style={{ ...scrubberValueStyle, fontSize: 20 }}>{seasonMonth(seasonProgress)}</span>
        </div>
        <ScrubberTrack
          value={seasonProgress}
          min={0}
          max={1}
          step={0.01}
          onChange={setSeasonProgress}
          ariaLabel="Season"
          labels={["Jan", "Apr", "Jul", "Oct", "Dec"]}
        />
      </GlassCard>

      {/* ---- Top-right: live conditions chips ---- */}
      <GlassCard position="top-right" style={{ padding: "10px 14px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 12, color: "var(--gs-ink)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gs-ink-secondary)" }}>
            Live Conditions
          </div>
          <div style={{ color: "var(--gs-ink-secondary)", lineHeight: 1.7 }}>
            Season: <span style={{ color: "var(--gs-ink)" }}>{seasonLabel(seasonProgress)}</span><br />
            Leaf Status: <span style={{ color: "var(--gs-primary)" }}>{leafStatus(seasonProgress, year)}</span><br />
            Sun Elev: <span style={{ color: "var(--gs-ink)" }}>{sunMin}</span> min
          </div>
        </div>
      </GlassCard>
      <GlassCard position="bottom-left" style={{ padding: "10px 14px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 12, color: "var(--gs-ink)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gs-ink-secondary)" }}>
            Growth Axis
          </div>
          <div style={{ color: "var(--gs-ink-secondary)", lineHeight: 1.7 }}>
            Year: <span style={{ color: "var(--gs-primary)" }}>{year.toFixed(0)}</span> / 10<br />
            Root Spread: <span style={{ color: "var(--gs-ink)" }}>{(growthFactor * 100).toFixed(0)}%</span>
          </div>
        </div>
      </GlassCard>
    </WebGLStudio>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI primitives                                                       */
/* -------------------------------------------------------------------------- */

const scrubberLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const scrubberValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 24,
  fontWeight: 500,
  color: "var(--gs-primary)",
};

/** Small toggle chip button. */
function ToggleChip({
  active,
  onClick,
  activeColor,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 8,
        border: "1px solid var(--gs-line)",
        background: active ? activeColor : "transparent",
        color: active ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      {children}
    </button>
  );
}

/** A reusable scrubber track with a progress fill + range input overlay. */
function ScrubberTrack({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  labels,
  highlightValues,
  currentHighlight,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  labels: string[];
  highlightValues?: number[];
  currentHighlight?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 4,
          background: "var(--gs-line)",
          borderRadius: 9999,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${pct}%`,
            background: "var(--gs-primary)",
            borderRadius: 9999,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            opacity: 0,
            cursor: "pointer",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            width: 14,
            height: 14,
            transform: "translate(-50%, -50%)",
            background: "var(--gs-primary)",
            border: "2px solid var(--gs-canvas)",
            borderRadius: "50%",
            boxShadow: "0 0 10px rgba(251,191,36,0.6)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontFamily: "var(--font-tech)",
          fontSize: 12,
          color: "var(--gs-ink-secondary)",
        }}
      >
        {labels.map((label, i) => {
          const isHighlight =
            highlightValues && currentHighlight !== undefined
              ? label.includes(String(currentHighlight))
              : false;
          return (
            <span
              key={i}
              style={{ color: isHighlight ? "var(--gs-primary)" : "var(--gs-ink-secondary)" }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </>
  );
}

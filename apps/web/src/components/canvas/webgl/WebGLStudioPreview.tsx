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
import { VignetteOverlay } from "./VignetteOverlay";
import { SaveStatusChip } from "./SaveStatusChip";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useStudioStore,
  seasonLabel,
  seasonMonth,
  leafStatus,
} from "./studioStore";
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";
import { SliceProfileCard } from "./SliceProfileCard";
import { DrainageFlowCard } from "./DrainageFlowCard";
import { EarthworksCard } from "./EarthworksCard";
import { FitSheetCard } from "./FitSheetCard";
import { AssetFanOutDock } from "./AssetFanOutDock";
import { StudioToolRail } from "./StudioToolRail";
import { placementsToItems } from "../handoff/state/canvasBridge";
import { toRenderItems } from "./stateBridge";

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
  /** Project latitude (decimal degrees). Defaults to Prahran demo. */
  lat?: number;
  lng?: number;
  /** Project address — feeds the flora ring's municipality ranking. */
  projectAddress?: string;
  /** Persisted canvas strokes (hydrated into the store on mount). */
  initialStrokes?: CanvasStroke[];
  /** Persisted placements — hydrated into the store on mount; the store is
   *  the live source thereafter (items + autosave derive from it). */
  placements?: CatalogPlacement[];
  /** BYDA assets from site_frame → converted to subsurface utilities. */
  bydaAssets?: DesignBydaAsset[];
  /** Construction trenches → converted to excavations for strike detection. */
  constructionTrenches?: ConstructionTrench[];
  /** Irrigation zones → feed hydraulic calculations. */
  irrigationZones?: IrrigationZone[];
  /** Spot levels from site_frame → feed terrain heightmap. */
  levels?: DesignSiteFrameLevel[];
  /** Outdoor area m² (page-computed from survey/title/site_frame) → fit-sheet. */
  outdoorM2?: number;
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
  lat,
  lng,
  projectAddress = "",
  initialStrokes,
  placements: initialPlacements = [],
  bydaAssets = [],
  constructionTrenches = [],
  irrigationZones = [],
  levels = [],
  outdoorM2 = 0,
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
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);
  const setViewBlendTarget = useStudioStore((s) => s.setViewBlendTarget);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  // Save status is rendered by <SaveStatusChip /> which subscribes independently
  // (so only the chip re-renders on status change, not the whole HUD).

  // --- Hydrate the store on mount (strokes + placements + project context) ---
  // This runs once when the component mounts with the server-fetched data.
  const hydratedRef = useState({ done: false });
  useEffect(() => {
    if (hydratedRef[0].done) return;
    hydratedRef[0].done = true;
    const store = useStudioStore.getState();
    store.setSketchStrokes(initialStrokes ?? []);
    store.setPlacements(initialPlacements);
    store.setProjectContext(projectId, aerialUri, projectAddress);
    if (initialSketchMode) store.setSketchMode(true);
  }, [initialStrokes, initialPlacements, projectId, aerialUri, projectAddress, initialSketchMode, hydratedRef]);

  // Placements live in the store after hydration — the live source for both
  // the 3D items and the autosave doc. Pure client-side bridge (proven in
  // the SVG studio's client hook); unknown symbol ids degrade gracefully.
  const storePlacements = useStudioStore((s) => s.placements);
  const items = useMemo(
    () => toRenderItems(placementsToItems(storePlacements)),
    [storePlacements],
  );

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
    () => ({ placements: storePlacements, strokes }),
    [storePlacements, strokes],
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

  // Pads exist ⇔ any committed stroke carries an extrusion height — gates the
  // Earth toggle + EarthworksCard.
  const hasPads = useMemo(
    () => strokes.some((s) => (s.extrude_height_m ?? 0) > 0),
    [strokes],
  );

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
      {/* Atmospheric vignette — matches the 3D post-processing, fades with blend */}
      <VignetteOverlay />

      {/* Left slim tool icons — bare (no container), border chrome per the
          Stitch reference; the drawing owns the middle. */}
      <StudioToolRail
        showTerrainTools={liveData.heightmapPoints.length > 0}
        showDims={boundaryPct.length >= 3}
        showEarth={liveData.heightmapPoints.length > 0 && hasPads}
        showQuote={(items?.length ?? 0) > 0}
        presentActive={presentationMode}
        onPresentToggle={() => setPresentationMode((p) => !p)}
      />

      {/* Asset discovery fan-out dock — bottom-centre, above the growth card */}
      <AssetFanOutDock />

      {/* ---- Top-left: compact studio meta + view toggle ---- */}
      <GlassCard position="top-left" style={{ padding: "8px 10px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 10, color: "var(--gs-ink)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, letterSpacing: "0.06em" }}>STUDIO</span>
            {/* Canvas meta as one dense chip line — the drawing IS the hero */}
            <span style={{ color: "var(--gs-ink-secondary)", fontSize: 9 }}>
              B{stats.boundaryPoints} · I{stats.items} · S{stats.strokes}
              {stats.strikes > 0 && (
                <span style={{ color: "var(--gs-conflict)" }}> · ⚠{stats.strikes}</span>
              )}
              {" "}| {stats.scaleM.toFixed(0)}m
            </span>
          </div>
          {/* Save status chip — zero layout shift, fixed-width reserved space */}
          <div style={{ marginBottom: 4 }}>
            <SaveStatusChip />
          </div>

          {/* View toggle — Plan ↔ 3D (drives the fused camera) */}
          <div
            style={{
              display: "flex",
              borderRadius: 6,
              border: "1px solid var(--gs-line)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewBlendTarget(0)}
              style={{
                flex: 1,
                padding: "2px 10px",
                border: "none",
                background: !is3D ? "var(--gs-primary)" : "transparent",
                color: !is3D ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: 10,
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
                padding: "2px 10px",
                border: "none",
                background: is3D ? "var(--gs-primary)" : "transparent",
                color: is3D ? "var(--gs-canvas)" : "var(--gs-ink-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              3D
            </button>
          </div>

          {/* Measure readout — DOM twin of the in-canvas tape label. A11y +
              e2e surface; subscribes independently so only the chip re-renders. */}
          <MeasureReadoutChip scaleM={scaleM} boardAspect={boardAspect} />
        </div>
      </GlassCard>

      {/* ---- Bottom-center: growth timeline scrubber (compact) ---- */}
      <GlassCard
        position={{
          bottom: 16,
          // Safe-zone centre (clear of the tool rail + right column).
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
        }}
        style={{
          width: "min(30rem, calc(100vw - 620px))",
          padding: "8px 12px",
        }}
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

      {/* ---- Top-center: sun + season scrubbers (compact twin row) ---- */}
      <div
        style={{
          position: "absolute",
          top: 12,
          // Safe-zone centre (clear of the tool rail + right column).
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          pointerEvents: "none",
        }}
      >
        <GlassCard position={{ position: "relative" }} style={{ width: 224, padding: "6px 10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={scrubberLabelStyle}>Sun</span>
            <span style={{ ...scrubberValueStyle, fontSize: 14 }}>
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
        <GlassCard position={{ position: "relative" }} style={{ width: 224, padding: "6px 10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={scrubberLabelStyle}>Season · {seasonLabel(seasonProgress)}</span>
            <span style={{ ...scrubberValueStyle, fontSize: 14 }}>{seasonMonth(seasonProgress)}</span>
          </div>
          <ScrubberTrack
            value={seasonProgress}
            min={0}
            max={1}
            step={0.01}
            onChange={setSeasonProgress}
            ariaLabel="Season"
            labels={["Jan", "Jul", "Dec"]}
          />
        </GlassCard>
      </div>

      {/* ---- THE right-hand chrome column — one column, flex-laid-out.
          Two independently anchored stacks on the same edge collided when
          the fit-sheet grew (caught by webgl-chrome-collision.spec); a single
          flex column cannot self-intersect, and scrolls internally in the
          everything-on state. Fit-content width keeps the strip narrow. */}
      <div
        data-testid="right-chrome-column"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          maxHeight: "calc(100dvh - 24px)",
          overflowY: "auto",
          pointerEvents: "auto",
          width: "fit-content",
          scrollbarWidth: "thin",
        }}
      >
        {/* Live conditions as a meta chip set — not a card block */}
        <div
          data-gs-glass-card
          style={{
            display: "flex",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
            backdropFilter: "blur(var(--gs-blur))",
            WebkitBackdropFilter: "blur(var(--gs-blur))",
            border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
            pointerEvents: "auto",
          }}
        >
          <MetaChip label="Season" value={seasonLabel(seasonProgress)} />
          <MetaChip label="Leaf" value={leafStatus(seasonProgress, year)} accent />
          <MetaChip label="Sun" value={`${sunMin}m`} />
        </div>
        {(items?.length ?? 0) > 0 && (
          <FitSheetCard
            items={items ?? []}
            boundaryPct={boundaryPct}
            constructionTrenches={constructionTrenches}
            irrigationZones={irrigationZones}
            scaleM={scaleM}
            outdoorM2={outdoorM2}
          />
        )}
        {liveData.heightmapPoints.length > 0 && (
          <SliceProfileCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
          />
        )}
        {liveData.heightmapPoints.length > 0 && (
          <DrainageFlowCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
            hydraulicResults={liveData.hydraulicResults}
          />
        )}
        {liveData.heightmapPoints.length > 0 && (
          <EarthworksCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
          />
        )}
      </div>
    </WebGLStudio>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI primitives                                                       */
/* -------------------------------------------------------------------------- */

const scrubberLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const scrubberValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--gs-primary)",
};

/** A tiny meta chip — label + value in one pill (canvas-first chrome unit). */
function MetaChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
        fontFamily: "var(--font-tech)",
        fontSize: 9,
        color: "var(--gs-ink-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: accent ? "var(--gs-primary)" : "var(--gs-ink)", fontSize: 10 }}>
        {value}
      </span>
    </span>
  );
}

/**
 * Measure tape readout — the DOM twin of the in-canvas tape label. Renders
 * the live/last measurement in true metres while the tool is armed and a
 * tape exists. Subscribes to the store independently so pointer-move updates
 * re-render only this chip, not the whole HUD (SaveStatusChip pattern).
 */
function MeasureReadoutChip({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const measureActive = useStudioStore((s) => s.measureActive);
  const tape = useStudioStore((s) => s.measureTape);

  if (!measureActive || !tape) return null;

  const [ax, az] = pctToWorld(tape.a, scaleM, boardAspect);
  const [bx, bz] = pctToWorld(tape.b, scaleM, boardAspect);
  const lengthM = Math.hypot(bx - ax, bz - az);

  return (
    <div
      data-testid="measure-readout"
      style={{
        marginTop: 4,
        fontFamily: "var(--font-tech)",
        fontSize: 10,
        color: "var(--gs-primary)",
      }}
    >
      Measure · {lengthM.toFixed(2)} m · Esc clears
    </div>
  );
}

/** A reusable scrubber track with a progress fill + range input overlay (compact). */
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
          height: 3,
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
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
            background: "var(--gs-primary)",
            border: "2px solid var(--gs-canvas)",
            borderRadius: "50%",
            boxShadow: "0 0 8px rgba(251,191,36,0.6)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "var(--font-tech)",
          fontSize: 9,
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

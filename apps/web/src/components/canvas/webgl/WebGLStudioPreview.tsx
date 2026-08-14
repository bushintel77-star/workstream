"use client";

/**
 * Dev-only preview wrapper for the WebGL studio.
 *
 * Mounts the WebGLStudio with boundary/building/items extracted from the same
 * site_frame data the page already loads, plus sample subsurface utilities and
 * a tilt toggle so the Phase 2 engines can be visually verified.
 */

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { GlassCard } from "./GlassCard";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";
import type { SubsurfaceUtility } from "./features/SubsurfaceEngine";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useSeasonalStore,
  seasonLabel,
  seasonMonth,
  leafStatus,
} from "./seasonalStore";

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
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  items?: RenderItem[];
  /** Project latitude (decimal degrees). Defaults to Prahran demo. */
  lat?: number;
  /** Project longitude (decimal degrees). Defaults to Prahran demo. */
  lng?: number;
}

export function WebGLStudioPreview({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  items,
  lat,
  lng,
}: WebGLStudioPreviewProps) {
  const [rig, setRig] = useState<StudioCameraRig>(DEFAULT_CAMERA_RIG);
  const [presentationMode, setPresentationMode] = useState(false);

  // Dual-axis time state — zustand store (shared with the useFrame loops).
  // DOM HUD subscribes here (re-renders DOM only); the 3D scene reads via
  // getState() in useFrame (zero re-renders).
  const year = useSeasonalStore((s) => s.growthYear);
  const setYear = useSeasonalStore((s) => s.setGrowthYear);
  const growthFactor = year / 10;
  const sunMin = useSeasonalStore((s) => s.sunMin);
  const setSunMin = useSeasonalStore((s) => s.setSunMin);
  const seasonProgress = useSeasonalStore((s) => s.seasonProgress);
  const setSeasonProgress = useSeasonalStore((s) => s.setSeasonProgress);
  // Subsurface blueprint view — toggles the vellum ground + hairline CAD lines.
  const subsurfaceView = useSeasonalStore((s) => s.subsurfaceView);
  const setSubsurfaceView = useSeasonalStore((s) => s.setSubsurfaceView);
  // 3D sketch mode — locks the camera, drapes strokes over the 3D terrain.
  const sketchMode = useSeasonalStore((s) => s.sketchMode);
  const setSketchMode = useSeasonalStore((s) => s.setSketchMode);

  // Sample subsurface utilities for Phase 2 visual verification
  const sampleUtilities: SubsurfaceUtility[] = useMemo(
    () => [
      {
        id: "util-gas-1",
        type: "gas",
        start: [-scaleM * 0.3, -scaleM * 0.2],
        end: [scaleM * 0.3, scaleM * 0.2],
        depthM: 0.6,
        toleranceM: 0.3,
      },
      {
        id: "util-water-1",
        type: "water",
        start: [-scaleM * 0.35, scaleM * 0.1],
        end: [scaleM * 0.35, -scaleM * 0.1],
        depthM: 0.5,
        toleranceM: 0.25,
      },
      {
        id: "util-elec-1",
        type: "electric",
        start: [0, -scaleM * 0.35],
        end: [0, scaleM * 0.35],
        depthM: 0.7,
        toleranceM: 0.2,
      },
    ],
    [scaleM],
  );

  const stats = useMemo(
    () => ({
      boundaryPoints: boundaryPct.length,
      buildingPoints: buildingPct?.length ?? 0,
      easements: easementsPct?.length ?? 0,
      items: items?.length ?? 0,
      scaleM,
      tilt: rig.tiltDeg,
      utilities: sampleUtilities.length,
    }),
    [boundaryPct, buildingPct, easementsPct, items, scaleM, rig.tiltDeg, sampleUtilities.length],
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
      subsurfaceUtilities={sampleUtilities}
      lens={presentationMode ? PRESENTATION_LENS : TECHNICAL_LENS}
      growthFactor={growthFactor}
      lat={lat}
      lng={lng}
      sunMin={sunMin}
    >
      {/* Dev overlay — scene stats + tilt toggle */}
      <GlassCard position="top-left" style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 13, color: "var(--gs-ink)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>WebGL Preview</div>
          <div style={{ color: "var(--gs-ink-secondary)", lineHeight: 1.5 }}>
            Boundary: {stats.boundaryPoints} pts<br />
            Building: {stats.buildingPoints} pts<br />
            Items: {stats.items} | Utilities: {stats.utilities}<br />
            Scale: {stats.scaleM.toFixed(0)}m | Tilt: {stats.tilt}°<br />
            Zoom: {rig.zoom.toFixed(1)}× | Pan: {rig.panX.toFixed(0)}, {rig.panY.toFixed(0)}
          </div>
          <button
            onClick={() =>
              setRig((r) => ({ ...r, tiltDeg: r.tiltDeg > 1 ? 0 : 55 }))
            }
            style={{
              marginTop: 8,
              padding: "4px 12px",
              borderRadius: 8,
              border: "1px solid var(--gs-line)",
              background: rig.tiltDeg > 1 ? "var(--gs-primary)" : "transparent",
              color: rig.tiltDeg > 1 ? "var(--gs-canvas)" : "var(--gs-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {rig.tiltDeg > 1 ? "▾ Top-down" : "▸ Tilt 55°"}
          </button>
          <button
            onClick={() => setPresentationMode((p) => !p)}
            style={{
              marginTop: 4,
              marginLeft: 4,
              padding: "4px 12px",
              borderRadius: 8,
              border: "1px solid var(--gs-line)",
              background: presentationMode ? "var(--gs-primary)" : "transparent",
              color: presentationMode ? "var(--gs-canvas)" : "var(--gs-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {presentationMode ? "▾ Technical" : "▸ Present"}
          </button>
          <button
            onClick={() => setSubsurfaceView(!subsurfaceView)}
            style={{
              marginTop: 4,
              marginLeft: 4,
              padding: "4px 12px",
              borderRadius: 8,
              border: "1px solid var(--gs-line)",
              background: subsurfaceView ? "var(--gs-truth)" : "transparent",
              color: subsurfaceView ? "var(--gs-canvas)" : "var(--gs-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {subsurfaceView ? "▾ Physical" : "▸ Underground"}
          </button>
          <button
            onClick={() => setSketchMode(!sketchMode)}
            style={{
              marginTop: 4,
              marginLeft: 4,
              padding: "4px 12px",
              borderRadius: 8,
              border: "1px solid var(--gs-line)",
              background: sketchMode ? "var(--gs-primary)" : "transparent",
              color: sketchMode ? "var(--gs-canvas)" : "var(--gs-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {sketchMode ? "▾ Orbit" : "▸ Sketch 3D"}
          </button>
        </div>
      </GlassCard>

      {/* Temporal Scrubber HUD — 10-year growth simulation timeline (Phase 1.3) */}
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
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gs-ink-secondary)",
            }}
          >
            Phase 1.3 Simulation
          </span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: 24,
              fontWeight: 500,
              color: "var(--gs-primary)",
            }}
          >
            Year {year}
          </span>
        </div>
        {/* Timeline track */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 4,
            background: "var(--gs-line)",
            borderRadius: 9999,
          }}
        >
          {/* Progress fill */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${growthFactor * 100}%`,
              background: "var(--gs-primary)",
              borderRadius: 9999,
            }}
          />
          {/* Native range input overlaid for interaction (0→10, 1-year steps) */}
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Growth simulation year"
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
          {/* Active node (glows at the current year position) */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${growthFactor * 100}%`,
              width: 16,
              height: 16,
              transform: "translate(-50%, -50%)",
              background: "var(--gs-primary)",
              border: "2px solid var(--gs-canvas)",
              borderRadius: "50%",
              boxShadow: "0 0 10px rgba(251,191,36,0.6)",
              pointerEvents: "none",
            }}
          />
        </div>
        {/* Tick labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontFamily: "var(--font-tech)",
            fontSize: 13,
            color:
              year === 0
                ? "var(--gs-primary)"
                : "var(--gs-ink-secondary)",
          }}
        >
          <span style={{ color: year === 0 ? "var(--gs-primary)" : "var(--gs-ink-secondary)" }}>
            Year 0
          </span>
          <span style={{ color: year === 5 ? "var(--gs-primary)" : "var(--gs-ink-secondary)" }}>
            Year 5
          </span>
          <span style={{ color: year === 10 ? "var(--gs-primary)" : "var(--gs-ink-secondary)" }}>
            Year 10
          </span>
        </div>
      </GlassCard>

      {/* Sun Scrubber HUD — time-of-day drives the real sun position,
          so shadows swing and stretch across the day (Gold Standard UX). */}
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
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gs-ink-secondary)",
            }}
          >
            Sun Position · Real Shadows
          </span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--gs-primary)",
            }}
          >
            {String(Math.floor(sunMin / 60)).padStart(2, "0")}:
            {String(sunMin % 60).padStart(2, "0")}
          </span>
        </div>
        {/* Day arc track */}
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
              width: `${((sunMin - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
              background: "var(--gs-primary)",
              borderRadius: 9999,
            }}
          />
          <input
            type="range"
            min={DAY_START}
            max={DAY_END}
            step={5}
            value={sunMin}
            onChange={(e) => setSunMin(Number(e.target.value))}
            aria-label="Time of day"
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
              left: `${((sunMin - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
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
          <span>06:20</span>
          <span>13:00</span>
          <span>19:40</span>
        </div>
      </GlassCard>

      {/* Seasonal Scrubber HUD — Jan→Dec drives material properties, sun
          elevation, fog, and the canopy multiplier. Parallel to the 10-year
          growth axis (LA Seasonal Dynamics). */}
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
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gs-ink-secondary)",
            }}
          >
            Season · {seasonLabel(seasonProgress)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--gs-primary)",
            }}
          >
            {seasonMonth(seasonProgress)}
          </span>
        </div>
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
              width: `${seasonProgress * 100}%`,
              background: "var(--gs-primary)",
              borderRadius: 9999,
            }}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={seasonProgress}
            onChange={(e) => setSeasonProgress(Number(e.target.value))}
            aria-label="Season"
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
              left: `${seasonProgress * 100}%`,
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
          <span>Jan</span>
          <span>Apr</span>
          <span>Jul</span>
          <span>Oct</span>
          <span>Dec</span>
        </div>
      </GlassCard>

      {/* Seasonal Metadata Chips — live readouts (DOM, subscribes to store). */}
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

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
}

export function WebGLStudioPreview({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  items,
}: WebGLStudioPreviewProps) {
  const [rig, setRig] = useState<StudioCameraRig>(DEFAULT_CAMERA_RIG);
  const [presentationMode, setPresentationMode] = useState(false);

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
        </div>
      </GlassCard>
    </WebGLStudio>
  );
}

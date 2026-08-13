"use client";

/**
 * Dev-only preview wrapper for the WebGL studio.
 *
 * Mounts the WebGLStudio with boundary/building/items extracted from the same
 * site_frame data the page already loads. This is NOT the production mount —
 * it's a verification surface accessible via ?webgl=1 on any project page.
 *
 * It shows the WebGL board rendering real geometry so we can visually verify
 * the R3F scene before the full state bridge lands in Phase 1.5.
 */

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { GlassCard } from "./GlassCard";
import { DEFAULT_CAMERA_RIG } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";

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
  const [rig] = useState(DEFAULT_CAMERA_RIG);

  const stats = useMemo(
    () => ({
      boundaryPoints: boundaryPct.length,
      buildingPoints: buildingPct?.length ?? 0,
      easements: easementsPct?.length ?? 0,
      items: items?.length ?? 0,
      scaleM,
    }),
    [boundaryPct, buildingPct, easementsPct, items, scaleM],
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
    >
      {/* Dev overlay — shows scene stats. Removed when the feature flag is dropped. */}
      <GlassCard position="top-left" style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 13, color: "var(--gs-ink)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>WebGL Preview</div>
          <div style={{ color: "var(--gs-ink-secondary)", lineHeight: 1.5 }}>
            Boundary pts: {stats.boundaryPoints}<br />
            Building pts: {stats.buildingPoints}<br />
            Easements: {stats.easements}<br />
            Items: {stats.items}<br />
            Scale: {stats.scaleM.toFixed(0)}m
          </div>
        </div>
      </GlassCard>
    </WebGLStudio>
  );
}

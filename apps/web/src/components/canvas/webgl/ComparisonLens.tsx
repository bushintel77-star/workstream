"use client";

/**
 * Gold Standard 2026 — Comparison Lens.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Comparison Lens)
 *
 * "Side-by-side split-view for design iterations."
 *
 * Renders two WebGLStudio instances side-by-side (50/50 split), each showing
 * a different design variant. The camera is synced between both — panning or
 * zooming one updates the other, so the operator can compare the same view of
 * two different designs.
 *
 * Lives in the DOM chrome overlay layer (Layer 3) — the split is a CSS layout
 * concern, and each half has its own R3F Canvas.
 */

import { useState, useCallback, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { GlassCard } from "./GlassCard";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import type { RenderItem } from "./sceneItems";

const WebGLStudio = dynamic(() => import("./WebGLStudio").then((m) => m.WebGLStudio), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "var(--gs-canvas)" }} />,
});

export interface ComparisonLensProps {
  scaleM: number;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  /** Variant A items (left panel). */
  itemsA?: RenderItem[];
  /** Variant B items (right panel). */
  itemsB?: RenderItem[];
  labelA?: string;
  labelB?: string;
}

export function ComparisonLens({
  scaleM,
  boardAspect,
  boundaryPct,
  buildingPct,
  itemsA = [],
  itemsB = [],
  labelA = "Variant A",
  labelB = "Variant B",
}: ComparisonLensProps) {
  const [rig, setRig] = useState<StudioCameraRig>(DEFAULT_CAMERA_RIG);

  // Synced camera: both panels share the same rig state
  const handleRigChange = useCallback((newRig: StudioCameraRig) => {
    setRig(newRig);
  }, []);

  const halfStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    overflow: "hidden",
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--gs-canvas)" }}>
      {/* Left panel — Variant A */}
      <div style={{ ...halfStyle, left: 0, borderRight: "1px solid var(--gs-line)" }}>
        <WebGLStudio
          scaleM={scaleM}
          boardAspect={boardAspect}
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          items={itemsA}
          cameraRig={rig}
          onRigChange={handleRigChange}
        >
          <GlassCard position="top-left" style={{ padding: "8px 14px" }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--gs-primary)", letterSpacing: "0.05em" }}>
              {labelA.toUpperCase()}
            </span>
            <span style={{ fontFamily: "var(--font-tech)", fontSize: 11, color: "var(--gs-ink-secondary)", marginLeft: 8 }}>
              {itemsA.length} items
            </span>
          </GlassCard>
        </WebGLStudio>
      </div>

      {/* Right panel — Variant B */}
      <div style={{ ...halfStyle, right: 0 }}>
        <WebGLStudio
          scaleM={scaleM}
          boardAspect={boardAspect}
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          items={itemsB}
          cameraRig={rig}
          onRigChange={handleRigChange}
        >
          <GlassCard position="top-right" style={{ padding: "8px 14px" }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--gs-primary)", letterSpacing: "0.05em" }}>
              {labelB.toUpperCase()}
            </span>
            <span style={{ fontFamily: "var(--font-tech)", fontSize: 11, color: "var(--gs-ink-secondary)", marginLeft: 8 }}>
              {itemsB.length} items
            </span>
          </GlassCard>
        </WebGLStudio>
      </div>

      {/* Divider handle */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 2,
          transform: "translateX(-50%)",
          background: "var(--gs-primary)",
          opacity: 0.6,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    </div>
  );
}

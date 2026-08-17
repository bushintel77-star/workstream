"use client";

/**
 * Gold Standard 2026 — Split View Lens (plan ↔ 3D, linked cameras).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Comparison Lens) —
 * retargeted from variant A/B to the dual-screen workflow from the product
 * research brief: the CAD side (locked orthographic plan) and the sketch
 * side (live perspective) visible simultaneously, cameras LINKED — pan or
 * zoom on either half and both follow (one shared rig, the comparison-lens
 * pattern).
 *
 * Two full WebGLStudio canvases (50/50 CSS split): each keeps its own
 * EffectComposer — the only architecture that preserves the full post-FX
 * stack on both halves (a scissored single canvas conflicts with the
 * composer's render-loop takeover). The left half pins blend=0 via
 * viewBlendLocked; the right half follows the store's viewBlendTarget, so
 * the Plan/3D toggle drives the sketch side only.
 */

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { WebGLStudioProps } from "./WebGLStudio";

const WebGLStudio = dynamic(() => import("./WebGLStudio").then((m) => m.WebGLStudio), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "var(--gs-canvas)" }} />,
});

/** The scene props both halves share (everything but the camera plumbing). */
export type SplitSceneProps = Omit<
  WebGLStudioProps,
  "viewBlendLocked" | "children" | "style"
>;

export interface SplitViewLensProps {
  sceneProps: SplitSceneProps;
}

const halfStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "50%",
  overflow: "hidden",
};

const labelChip: CSSProperties = {
  position: "absolute",
  // Hug the centre divider (each chip renders inside its own half's
  // overlay, so right/left:12 = just off the divider), below the top
  // scrubber row — clear of the studio card, the twins, and the right
  // chrome column at every tested viewport (collision-spec guaranteed).
  top: 78,
  padding: "2px 9px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
  background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
  backdropFilter: "blur(var(--gs-blur))",
  WebkitBackdropFilter: "blur(var(--gs-blur))",
  fontFamily: "var(--font-tech)",
  fontSize: 10,
  letterSpacing: "0.08em",
  pointerEvents: "none",
};

export function SplitViewLens({ sceneProps }: SplitViewLensProps) {
  // Linked cameras: both halves share the store's live rig (pan/zoom on
  // either drives both — the whole point of the dual-screen workflow).
  return (
    <div
      data-testid="split-view-lens"
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--gs-canvas)" }}
    >
      {/* Left half — the CAD side: locked orthographic plan. */}
      <div style={{ ...halfStyle, left: 0, borderRight: "1px solid var(--gs-line)" }}>
        <WebGLStudio
          {...sceneProps}
          viewBlendLocked={0}
        >
          <div
            data-testid="split-label-plan"
            style={{ ...labelChip, right: 12, color: "var(--gs-truth-ink)" }}
          >
            PLAN · CAD
          </div>
        </WebGLStudio>
      </div>

      {/* Right half — the sketch side: live perspective. */}
      <div style={{ ...halfStyle, right: 0 }}>
        <WebGLStudio {...sceneProps}>
          <div
            data-testid="split-label-sketch"
            style={{ ...labelChip, left: 12, color: "var(--gs-primary)" }}
          >
            SKETCH · 3D
          </div>
        </WebGLStudio>
      </div>

      {/* Divider */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 2,
          transform: "translateX(-50%)",
          background: "var(--gs-primary)",
          opacity: 0.5,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    </div>
  );
}

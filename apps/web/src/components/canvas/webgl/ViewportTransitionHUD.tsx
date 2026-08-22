"use client";

/**
 * Gold Standard 2026 — Viewport Transition HUD.
 *
 * Floating chrome-tier capsule (top-right) that visualises and controls the
 * Fused Rendering Context tilt axis (the single continuous camera axis per
 * docs/GOLD-STANDARD-2026-ARCHITECTURE.md section 1.3).
 *
 * Reactive model:
 *   - Subscribes to a QUANTISED tilt (5 deg steps) so a pan/orbit gesture
 *     triggers at most ~18 React re-renders across the full 0-90 deg range.
 *     The gauge CSS width/left is transitioned, so perceived motion stays
 *     buttery between quantisation hops. Mirrors the DimensionLayer line-61
 *     selector pattern.
 *   - Text labels (2D Plan / 3D / Elev) are absolute-positioned siblings of
 *     the moving gauge - they never animate, satisfying the rock-solid
 *     label hierarchy requirement.
 *
 * Control model:
 *   - Three icon buttons preset the rig via the parent-supplied
 *     writeLiveRig bridge, or fall back to
 *     useStudioStore.getState().setLiveRig directly when the bridge is
 *     omitted. All three are primitive rig writes - the canvas engine
 *     interpolates the projection matrix on its RAF tick.
 *   - Preset patches follow existing conventions:
 *       CAD Plan     -> tiltDeg: 0                  (DEFAULT_CAMERA_RIG)
 *       Perspective  -> tiltDeg: OBLIQUE_PITCH_DEG
 *       Garden Angle -> tiltDeg: GARDEN_PITCH_DEG, zoom: 1.45 (applyGardenLook)
 *
 * Material model:
 *   - White frost (--gs-glass-veil) for working modes (survey, sketch,
 *     cad, elevation, garden, quote).
 *   - Dark glass (--cf-glass-dark) for presentation lens modes (present,
 *     share) so the chrome takes a backseat behind the takeover.
 *
 * Z-index: chrome tier (z=20) - sibling of the rest of the floating
 * Studio Paper chrome.
 */

import { useCallback } from "react";
import { clampBoardPct } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import {
  GARDEN_PITCH_DEG,
  OBLIQUE_PITCH_DEG,
  PITCH_MAX_DEG,
  type StudioCameraRig,
} from "./cameraRig";

const TILT_QUANT_STEP = 5;
const TILT_MAX = PITCH_MAX_DEG;
const TILT_PLAN = 0;
const TILT_PERSPECTIVE = OBLIQUE_PITCH_DEG;
const TILT_GARDEN = GARDEN_PITCH_DEG;
const TILT_GARDEN_ZOOM = 1.45;
const TILT_BLEND_BREAK = 0.5;

const PRESENTATION_MODES = new Set<string>(["present", "share"]);

function quantiseTilt(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.round(deg / TILT_QUANT_STEP) * TILT_QUANT_STEP;
}

export interface ViewportTransitionHUDProps {
  activeMode: string;
  writeLiveRig?: (rig: StudioCameraRig) => void;
  /**
   * Icon-only preset group, no gauge and no labels — for narrow viewports,
   * where the full capsule slid left into the drawing. The presets still work;
   * only the projection gauge is dropped.
   *
   * Survey no longer renders this component at all (it had nothing to project,
   * and the compact group still floated in the upper-right of the drawing).
   */
  compact?: boolean;
}

export function ViewportTransitionHUD({
  activeMode,
  writeLiveRig,
  compact = false,
}: ViewportTransitionHUDProps) {
  const tiltQuant = useStudioStore((s) => quantiseTilt(s.liveRig.tiltDeg));
  const isPresentation = PRESENTATION_MODES.has(activeMode);

  const write = useCallback(
    (patch: Partial<StudioCameraRig>) => {
      const store = useStudioStore.getState();
      const next: StudioCameraRig = { ...store.liveRig, ...patch };
      if (writeLiveRig) {
        writeLiveRig(next);
      } else {
        store.setLiveRig(next);
      }
    },
    [writeLiveRig],
  );

  const markerPct = clampBoardPct((tiltQuant / TILT_MAX) * 100);

  const presets = (
    <>
      <PresetButton
        label="Plan"
        compact={compact}
        active={tiltQuant < 5}
        onClick={() => write({ tiltDeg: TILT_PLAN })}
        aria-label="Lock to orthographic plan view (1)"
        icon={<CadPlanIcon />}
      />
      <PresetButton
        label="Orbit"
        compact={compact}
        active={tiltQuant >= 50 && tiltQuant < 65}
        onClick={() => write({ tiltDeg: TILT_PERSPECTIVE })}
        aria-label="Snap to perspective oblique orbit (2)"
        icon={<PerspectiveIcon />}
      />
      <PresetButton
        label="Garden"
        compact={compact}
        active={tiltQuant >= 70 && tiltQuant <= 82}
        onClick={() => write({ tiltDeg: TILT_GARDEN, zoom: TILT_GARDEN_ZOOM })}
        aria-label="Snap to garden eye-level viewpoint (3)"
        icon={<GardenIcon />}
      />
    </>
  );

  if (compact) {
    return (
      <div
        data-testid="viewport-transition-hud"
        data-compact="true"
        data-lens={isPresentation ? "dark" : "frost"}
        role="group"
        aria-label="Viewport projection presets"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "var(--gs-space-2)",
          padding: 4,
          borderRadius: "var(--gs-radius-lg)",
          fontFamily: "var(--font-ui)",
          color: "var(--gs-ink)",
          pointerEvents: "auto",
        }}
        className={`vth-root ${isPresentation ? "vth-dark" : "vth-frost"}`}
      >
        {presets}
      </div>
    );
  }

  return (
    <div
      data-testid="viewport-transition-hud"
      data-lens={isPresentation ? "dark" : "frost"}
      role="group"
      aria-label="Viewport projection transition"
      style={{
        position: "absolute",
        top: "var(--cf-edge-default, 16px)",
        right: "var(--cf-edge-default, 16px)",
        zIndex: "var(--cf-z-app)", // overlay chrome during viewport transitions
        display: "flex",
        flexDirection: "column",
        gap: "var(--gs-space-4)",
        padding: "10px 14px 12px",
        borderRadius: "var(--gs-radius-xl)",
        fontFamily: "var(--font-ui)",
        color: "var(--gs-ink)",
        pointerEvents: "auto",
      }}
      className={`vth-root ${isPresentation ? "vth-dark" : "vth-frost"}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--gs-space-6)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          Projection
        </span>
        <span
          aria-live="polite"
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            fontVariantNumeric: "tabular-nums",
            opacity: 0.6,
          }}
        >
          {tiltQuant}&deg;
        </span>
      </div>

      <div
        className="vth-track"
        style={{
          position: "relative",
          width: 200,
          height: 6,
          borderRadius: "var(--gs-radius-xs)",
          background: "color-mix(in srgb, currentColor 12%, transparent)",
          overflow: "visible",
        }}
        aria-hidden
      >
        <div
          className="vth-fill"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${markerPct}%`,
            borderRadius: "var(--gs-radius-xs)",
            background:
              "linear-gradient(90deg, var(--gs-primary) 0%, var(--gs-truth) 100%)",
            transition: "width 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${(TILT_BLEND_BREAK / TILT_MAX) * 100}%`,
            top: -2,
            bottom: -2,
            width: 1,
            background: "currentColor",
            opacity: 0.35,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${(TILT_PERSPECTIVE / TILT_MAX) * 100}%`,
            top: -2,
            bottom: -2,
            width: 1,
            background: "currentColor",
            opacity: 0.35,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${(TILT_GARDEN / TILT_MAX) * 100}%`,
            top: -2,
            bottom: -2,
            width: 1,
            background: "currentColor",
            opacity: 0.35,
          }}
        />
        <div
          className="vth-marker"
          style={{
            position: "absolute",
            left: `calc(${markerPct}% - 5px)`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--gs-primary)",
            boxShadow:
              "0 0 0 2px color-mix(in srgb, var(--gs-paper, #fff) 100%, transparent)",
            transition: "left 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          width: 200,
          height: 12,
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-micro)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
        aria-hidden
      >
        <span style={{ position: "absolute", left: 0, opacity: 0.55 }}>
          2D Plan
        </span>
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            opacity: 0.55,
          }}
        >
          3D
        </span>
        <span style={{ position: "absolute", right: 0, opacity: 0.55 }}>
          Elev
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "var(--gs-space-3)",
          marginTop: 4,
        }}
      >
        {presets}
      </div>
    </div>
  );
}

function PresetButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  compact?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props["aria-label"]}
      aria-pressed={props.active}
      data-active={props.active}
      className="vth-preset"
      style={{
        flex: props.compact ? "0 0 auto" : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: props.compact ? "5px" : "7px 4px 5px",
        border: "1px solid color-mix(in srgb, currentColor 15%, transparent)",
        borderRadius: "var(--gs-radius-lg)",
        background: props.active
          ? "color-mix(in srgb, var(--gs-primary) 12%, transparent)"
          : "transparent",
        cursor: "pointer",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-micro)",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: props.active ? "var(--gs-primary-ink)" : "inherit",
        transition: "all 140ms ease-out",
      }}
    >
      <span style={{ width: 22, height: 22, display: "block" }}>{props.icon}</span>
      {props.compact ? null : <span>{props.label}</span>}
    </button>
  );
}

function CadPlanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PerspectiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 17 L13 14 L19 17 L11 20 Z" />
      <path d="M5 17 L5 9 L13 6 L19 9 L19 17" />
      <line x1="13" y1="6" x2="13" y2="14" />
      <line x1="5" y1="9" x2="19" y2="9" strokeDasharray="2 2" opacity="0.5" />
    </svg>
  );
}

function GardenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="2" y1="14" x2="22" y2="14" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M9 14 L9 10" />
      <path d="M9 10 L6 13 M9 10 L12 13" />
      <path d="M7 8 L11 8 M6.5 9 L11.5 9" />
      <path d="M2 18 Q 12 16 22 18" strokeDasharray="2 1.5" opacity="0.5" />
    </svg>
  );
}

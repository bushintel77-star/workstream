"use client";

/**
 * Landscape Canvas v2 — the camera dock (handoff §6.1).
 *
 * Bottom centre, exclusively the camera. Four buttons: PLAN, AXO, SEC, 3D.
 * Replaces the Stage One tool dock's position at bottom centre — the tool
 * dock is now the vertical ribbon (ToolRibbon).
 *
 *   PLAN — ortho, tilt 0°, pure top-down, orbit disabled, pan/zoom only
 *   AXO  — ortho, tilt 22°, volume without perspective, orbit snaps 45°
 *   SEC  — ortho, tilt 90°, elevation / cross-section when a cut line is set
 *   3D   — perspective blend, free drone orbit, drafting tools grey out
 *
 * Hotkeys 1–4 (no modifier — see VIEWPORT_BY_DIGIT), 320ms blend on the
 * projection matrix (never a cut). Long-press reverts to the last state.
 * CAM/ORTHO status cap at the dock's left end; Time/Sun pill at the right,
 * wired to sun azimuth.
 */

import { useCallback } from "react";
import { useStudioStore, type CameraPreset } from "./studioStore";
import { AiRunDock } from "./AiRunDock";
import styles from "./CameraDock.module.css";

/** Sun-time step (minutes) — the time pill cycles the sun azimuth in this
 *  increment per click (24-hour loop). */
const SUN_TIME_STEP_MIN = 30;
const MIN_PER_DAY = 24 * 60;

/* ---- camera button definitions (handoff §6.1) ---- */

interface CameraButton {
  preset: CameraPreset;
  label: string;
  glyph: string;
  hotkey: string;
}

const CAMERA_BUTTONS: CameraButton[] = [
  { preset: "plan", label: "PLAN", glyph: "plan", hotkey: "1" },
  { preset: "axo", label: "AXO", glyph: "axo", hotkey: "2" },
  { preset: "sec", label: "SEC", glyph: "sec", hotkey: "3" },
  { preset: "3d", label: "3D", glyph: "3d", hotkey: "4" },
];

/* ---- inline SVG glyphs ---- */

function CameraGlyph({ name }: { name: string }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "plan":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2 2" opacity="0.5" />
          <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" opacity="0.5" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "axo":
      return (
        <svg {...common}>
          <path d="M4 18L12 4L20 18L12 22Z" />
          <path d="M4 18L12 14L20 18" opacity="0.5" />
          <line x1="12" y1="4" x2="12" y2="14" opacity="0.5" strokeDasharray="2 2" />
        </svg>
      );
    case "sec":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="4" y2="20" />
          <line x1="20" y1="4" x2="20" y2="20" />
          <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 2" />
          <path d="M8 8l4 4-4 4" opacity="0.5" />
          <path d="M16 8l-4 4 4 4" opacity="0.5" />
        </svg>
      );
    case "3d":
      return (
        <svg {...common}>
          <path d="M12 2L3 7v10l9 5 9-5V7z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" opacity="0.5" />
        </svg>
      );
    default:
      return null;
  }
}

/* ---- component ---- */

export function CameraDock() {
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const setCameraPreset = useStudioStore((s) => s.setCameraPreset);
  const penDown = useStudioStore((s) => s.penDown);
  const sunMin = useStudioStore((s) => s.sunMin);
  const setSunMin = useStudioStore((s) => s.setSunMin);
  const draftingMode = useStudioStore((s) => s.draftingMode);

  const onPreset = useCallback(
    (preset: CameraPreset) => {
      setCameraPreset(preset);
    },
    [setCameraPreset],
  );

  // Cycle the sun time forward by one step, wrapping past 24:00. Clicking the
  // time pill is the only chrome affordance on the sun azimuth — the light
  // rig + shadow footprints update live from sunMin (seasonProgressFromSun).
  const onCycleSunTime = useCallback(() => {
    const next = (sunMin + SUN_TIME_STEP_MIN) % MIN_PER_DAY;
    setSunMin(next);
  }, [sunMin, setSunMin]);

  // CAM / ORTHO status cap (left end)
  const isOrtho = cameraPreset !== "3d";
  const statusCap = isOrtho ? "ORTHO" : "PERSP";

  // Time/Sun pill (right end) — 14:20 format from sunMin
  const hours = Math.floor(sunMin / 60);
  const minutes = sunMin % 60;
  const timeLabel = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return (
    <div
      className={`${styles.dock} ${penDown ? styles.dockHidden : ""}`}
      data-testid="camera-dock"
      data-camera-preset={cameraPreset}
    >
      {/* Status cap — CAM / ORTHO at the left end */}
      <div className={styles.statusCap}>
        <span className={styles.statusCapLabel}>{statusCap}</span>
      </div>

      <div className={styles.statusDivider} />

      {/* Camera buttons */}
      <div className={styles.buttonGroup}>
        {CAMERA_BUTTONS.map((btn) => (
          <button
            key={btn.preset}
            className={`${styles.button} ${cameraPreset === btn.preset ? styles.buttonActive : ""}`}
            data-camera-button={btn.preset}
            onClick={() => onPreset(btn.preset)}
            title={`${btn.label} (${btn.hotkey})`}
          >
            {/* Active pip — 18x2px at top (§4 geometry) */}
            {cameraPreset === btn.preset && <span className={styles.activePip} />}
            <span className={styles.buttonGlyph}>
              <CameraGlyph name={btn.glyph} />
            </span>
            <span className={styles.buttonLabel}>{btn.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.statusDivider} />

      {/* Time/Sun pill — right end, wired to sun azimuth */}
      <button
        className={styles.timePill}
        onClick={onCycleSunTime}
        title={`Sun time — click to step +${SUN_TIME_STEP_MIN} min (loops at 24:00)`}
      >
        <span className={styles.timePillLabel}>{timeLabel}</span>
      </button>

      {/* Phase S — AI run dock, beside the time pill. No prompt box;
          the drawing is the prompt. */}
      <AiRunDock />

      {/* Rig caption — drafting mode indicator */}
      {draftingMode && (
        <div className={styles.rigCaption}>SNAP</div>
      )}
    </div>
  );
}

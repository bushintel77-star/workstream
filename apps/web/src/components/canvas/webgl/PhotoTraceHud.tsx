"use client";

/**
 * Gold Standard 2026 — Photo-Trace HUD.
 *
 * The only chrome that appears while a photo is pinned. Trace mode shows the
 * calibration honesty stamp and drawing hints; calibrate mode hosts the
 * reference-line calibration: preset chips for known garden lengths, a custom
 * entry, the live draft length readout, and Apply — which rescales the plane
 * so the drawn line equals the reference. The HUD is viewport-anchored frost,
 * never on the drawing's optical centre.
 */

import { useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import { applyCalibrationRef } from "./PhotoTracePlane";
import { CALIBRATION_PRESETS } from "./photoTraceMath";

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  padding: "4px 10px",
  borderRadius: "var(--gs-radius-pill)",
  border: `1px solid ${
    active
      ? "color-mix(in srgb, var(--gs-primary) 50%, transparent)"
      : "color-mix(in srgb, var(--gs-line) 55%, transparent)"
  }`,
  background: active
    ? "color-mix(in srgb, var(--gs-primary) 14%, transparent)"
    : "transparent",
  color: active ? "var(--gs-primary)" : "var(--gs-ink-secondary)",
  cursor: "pointer",
});

export function PhotoTraceHud() {
  const session = useStudioStore((s) => s.photoTraceSession);
  const elevation = useStudioStore((s) =>
    session
      ? s.photoElevations.find((e) => e.id === session.elevationId) ?? null
      : null,
  );
  const setPhotoTraceSession = useStudioStore((s) => s.setPhotoTraceSession);
  const setPhotoCalibrateDraft = useStudioStore((s) => s.setPhotoCalibrateDraft);
  const setPhotoCalibrateReference = useStudioStore(
    (s) => s.setPhotoCalibrateReference,
  );
  const [custom, setCustom] = useState("");

  const draftLengthM = useMemo(() => {
    const draft = session?.calibrateDraft;
    if (!draft) return null;
    return Math.hypot(draft.b.u - draft.a.u, draft.b.v - draft.a.v);
  }, [session?.calibrateDraft]);

  if (!session || !elevation) return null;

  const reference = session.calibrateReferenceM;
  const label = session.calibrateLabel;

  const pickPreset = (metres: number, presetLabel: string) => {
    setCustom("");
    setPhotoCalibrateReference(metres, presetLabel);
  };

  const canApply =
    session.mode === "calibrate" &&
    session.calibrateDraft != null &&
    draftLengthM != null &&
    draftLengthM > 0 &&
    reference != null;

  return (
    <div
      data-testid="photo-trace-hud"
      style={{
        position: "absolute",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--gs-space-4)",
        maxWidth: "min(560px, calc(100% - 48px))",
        padding: "10px 12px",
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--gs-panel-frost)",
        backdropFilter: "blur(var(--gs-frost-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 70%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
        color: "var(--gs-ink)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--gs-space-4)", flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          PHOTO TRACE
        </span>
        <span style={{ fontSize: "var(--gs-font-sm)", color: "var(--gs-ink-secondary)" }}>
          {elevation.name}
        </span>
        <span
          data-testid="photo-trace-stamp"
          style={{
            fontSize: "var(--gs-font-xs)",
            color: elevation.calibration ? "var(--gs-ink-secondary)" : "var(--gs-ink-muted)",
          }}
        >
          {elevation.calibration
            ? `Calibrated against ${elevation.calibration.label}`
            : "Uncalibrated — traces are indicative"}
        </span>
        <span
          data-testid="photo-trace-boundary-stamp"
          style={{
            fontSize: "var(--gs-font-xs)",
            color: elevation.boundary_snap
              ? "var(--gs-ink-secondary)"
              : "var(--gs-ink-muted)",
          }}
        >
          {elevation.boundary_snap
            ? "· snapped to the title boundary"
            : "· position indicative"}
        </span>
      </div>

      {session.mode === "trace" ? (
        <>
          <p style={{ margin: 0, fontSize: "var(--gs-font-sm)", color: "var(--gs-ink-secondary)" }}>
            Draw on the photo — ink is stored in true metres on the plane.
            Swivel away and the pin releases; the trace stays on the sheet.
          </p>
          <div style={{ display: "flex", gap: "var(--gs-space-3)", flexWrap: "wrap" }}>
            <button
              type="button"
              data-testid="photo-trace-calibrate"
              onClick={() =>
                setPhotoTraceSession({ elevationId: elevation.id, mode: "calibrate" })
              }
              style={chipStyle(false)}
            >
              {elevation.calibration ? "Recalibrate" : "Calibrate"}
            </button>
            <button
              type="button"
              data-testid="photo-trace-exit"
              onClick={() => setPhotoTraceSession(null)}
              style={chipStyle(false)}
            >
              Exit photo trace
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: "var(--gs-font-sm)", color: "var(--gs-ink-secondary)" }}>
            Draw a line on the photo along a feature with a known length, then
            pick that length below. One known dimension calibrates the whole
            frame.
          </p>
          {draftLengthM != null && (
            <span
              data-testid="photo-calibrate-draft-length"
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-xs)",
                color: "var(--gs-ink-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Reference line: {draftLengthM.toFixed(2)} m on the plane
            </span>
          )}
          <div
            role="group"
            aria-label="Known reference lengths"
            style={{ display: "flex", gap: "var(--gs-space-3)", flexWrap: "wrap" }}
          >
            {CALIBRATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                data-testid="photo-calibrate-preset"
                aria-pressed={reference === preset.metres && label === preset.label}
                onClick={() => pickPreset(preset.metres, preset.label)}
                style={chipStyle(reference === preset.metres && label === preset.label)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "var(--gs-space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <label
              style={{ fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)" }}
              htmlFor="photo-calibrate-custom"
            >
              Custom (m)
            </label>
            <input
              id="photo-calibrate-custom"
              data-testid="photo-calibrate-custom"
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={custom}
              placeholder="e.g. 2.4"
              onChange={(e) => {
                setCustom(e.target.value);
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                  setPhotoCalibrateReference(v, `${v} m measured length`);
                } else {
                  setPhotoCalibrateReference(null, "");
                }
              }}
              style={{
                width: 84,
                padding: "4px 8px",
                fontSize: "var(--gs-font-h2)",
                borderRadius: "var(--gs-radius-chip)",
                border: "1px solid var(--gs-line)",
                background: "var(--gs-panel)",
                color: "var(--gs-ink)",
                fontFamily: "var(--font-tech)",
              }}
            />
            <button
              type="button"
              data-testid="photo-calibrate-apply"
              disabled={!canApply}
              onClick={() => applyCalibrationRef.current?.()}
              style={{
                ...chipStyle(false),
                background: canApply
                  ? "var(--gs-primary)"
                  : "color-mix(in srgb, var(--gs-primary) 8%, transparent)",
                border: canApply
                  ? "1px solid var(--gs-primary)"
                  : "1px solid var(--gs-line)",
                color: canApply ? "var(--gs-panel)" : "var(--gs-ink-muted)",
                cursor: canApply ? "pointer" : "not-allowed",
              }}
            >
              Apply calibration
            </button>
            <button
              type="button"
              onClick={() => {
                setPhotoCalibrateDraft(null);
                setPhotoTraceSession({ elevationId: elevation.id, mode: "trace" });
              }}
              style={chipStyle(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

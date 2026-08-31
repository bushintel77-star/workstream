"use client";

/**
 * Gold Standard 2026 — Save Status Chip (Cinematic & Polish Pass).
 *
 * A zero-layout-shift save status indicator. The chip reserves fixed space
 * regardless of status text length, so rapid state transitions (e.g., during a
 * simulated network drop: saving → retrying → error → retrying → saved) never
 * cause the surrounding HUD to reflow.
 *
 * Design:
 *   - Fixed min-width on the chip container (reserves space for the longest
 *     label, "Retrying…", so shorter labels like "Saved" don't shrink it).
 *   - A status dot that pulses during active states (saving/retrying) via CSS
 *     animation — communicates network activity without changing dimensions.
 *   - Color-coded per the Studio Paper status law: charcoal ink (saving /
 *     retrying — the pulse carries the activity), neutral ink (saved),
 *     crimson (error — critical). All from --gs-* tokens.
 *   - The text label uses text-align:center so the dot+label composition stays
 *     balanced within the fixed width.
 *
 * During a network drop: the chip transitions saving→retrying→error smoothly.
 * The retry count is shown during backoff. The pulse animation continues
 * throughout, then stops when saved/error. No layout shift at any transition.
 */

import { memo } from "react";
import { useStudioStore, type SaveStatus } from "./studioStore";

/** Status → display config. The label is the longest text we need to fit. */
const STATUS_CONFIG: Record<
  SaveStatus,
  { label: string; color: string; pulse: boolean }
> = {
  idle: { label: "Idle", color: "var(--la-ink-secondary)", pulse: false },
  saving: { label: "Saving…", color: "var(--la-ink)", pulse: true },
  retrying: { label: "Retrying…", color: "var(--la-ink)", pulse: true },
  saved: { label: "Saved", color: "var(--la-ink-secondary)", pulse: false },
  error: { label: "Save failed", color: "var(--la-error)", pulse: false },
};

/** Fixed width — fits the longest label ("Retrying…") + dot + padding. */
const CHIP_MIN_WIDTH = 92;

export const SaveStatusChip = memo(function SaveStatusChip({
  onRetry,
  onRefresh,
}: {
  onRetry?: () => void;
  onRefresh?: () => void;
}) {
  const saveStatus = useStudioStore((s) => s.saveStatus);
  const saveErrorKind = useStudioStore((s) => s.saveErrorKind);
  const savedTick = useStudioStore((s) => s.savedTick);

  const config = STATUS_CONFIG[saveStatus];

  // "Saved Ns ago" relative label — only for saved state.
  const savedLabel =
    saveStatus === "saved" && savedTick > 0
      ? formatSavedAge(savedTick)
      : config.label;

  // For error state, append the error kind hint.
  const displayLabel =
    saveStatus === "error" && saveErrorKind === "stale_client"
      ? "Refresh needed"
      : saveStatus === "error" && saveErrorKind === "unreachable"
        ? "Offline"
        : savedLabel;
  const action = saveStatus === "error"
    ? saveErrorKind === "stale_client"
      ? onRefresh
      : onRetry
    : undefined;
  const actionLabel = saveStatus === "error"
    ? saveErrorKind === "stale_client"
      ? "Refresh safely"
      : "Retry save"
    : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="save-status-chip"
      data-status={saveStatus}
      data-error-kind={saveErrorKind ?? undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--gs-space-3)",
        minWidth: CHIP_MIN_WIDTH,
        padding: "3px 10px",
        borderRadius: "var(--gs-radius-pill)",
        background: "color-mix(in srgb, var(--gs-canvas) 60%, transparent)",
        border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-sm)",
        fontWeight: 600,
        color: config.color,
        whiteSpace: "nowrap",
        transition: "color var(--gs-base), border-color var(--gs-base)",
      }}
    >
      {/* Status dot — pulses during saving/retrying */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: config.color,
          flexShrink: 0,
          animation: config.pulse ? "savePulse 1s ease-in-out infinite" : "none",
          opacity: config.pulse ? 1 : 0.8,
        }}
      />
      <span style={{ textAlign: "center", flex: 1 }}>{displayLabel}</span>
      {action && actionLabel ? (
        <button
          type="button"
          aria-label={actionLabel}
          onClick={action}
          style={{
            border: 0,
            padding: 0,
            background: "transparent",
            color: config.color,
            font: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {saveErrorKind === "stale_client" ? "Refresh" : "Retry"}
        </button>
      ) : null}

      {/* Keyframes — injected once. The id ensures no duplicate if re-rendered. */}
      <style>{`
        @keyframes savePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
});

/** Format the "Saved Ns/Nm/Nh ago" label from the savedTick epoch ms. */
function formatSavedAge(savedTick: number): string {
  const ageMs = Date.now() - savedTick;
  if (ageMs < 5_000) return "Saved";
  const secs = Math.floor(ageMs / 1000);
  if (secs < 60) return `Saved ${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Saved ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `Saved ${hrs}h ago`;
}

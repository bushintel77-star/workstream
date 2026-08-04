"use client";

import { useEffect, useState } from "react";
import css from "./unifiedSaveStatus.module.css";

type SaveStatus = "idle" | "saving" | "retrying" | "saved" | "error";
type SaveErrorKind = "unreachable" | "stale_client" | "rejected" | null;

type Props = {
  status: SaveStatus;
  /** Epoch ms of last successful persist. */
  savedTick: number;
  /** Monotonic revision after each successful autosave. */
  revision: number;
  errorKind?: SaveErrorKind;
  onSave: () => void;
  onRetry: () => void;
};

function ageLabel(savedTick: number, now: number): string {
  if (savedTick <= 0) return "Saved";
  const sec = Math.max(0, Math.floor((now - savedTick) / 1000));
  if (sec < 4) return "Saved";
  if (sec < 60) return `Saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Saved ${min}m ago`;
  return `Saved ${Math.floor(min / 60)}h ago`;
}

/**
 * Unified save status indicator — single source of truth for autosave state
 * across canvas modes and the Present deck composer. Replaces the separate
 * CanvasAutosaveChip (canvas stream) and PresentSurface .saveStatus span
 * (deck stream). Strict boolean rendering: never shows saving + saved at once.
 *
 * The active surface (canvas vs deck) is chosen by the caller via the props
 * passed — HandoffDesignStudio switches the source by mode.
 */
export function UnifiedSaveStatus({
  status,
  savedTick,
  revision,
  errorKind = null,
  onSave,
  onRetry,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "saved" || savedTick <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 4000);
    return () => window.clearInterval(id);
  }, [status, savedTick]);

  useEffect(() => {
    if (status === "saved") setNow(Date.now());
  }, [status, savedTick]);

  const rev = revision > 0 ? `v${revision}` : null;

  if (status === "error") {
    const stale = errorKind === "stale_client";
    return (
      <button
        type="button"
        className={`${css.chip} ${css.chipError}`}
        data-testid="autosave-tick"
        data-status={status}
        data-error-kind={errorKind ?? "rejected"}
        title={
          stale
            ? "App updated — refresh to keep saving"
            : "Autosave failed — click to retry"
        }
        onClick={() => {
          if (stale) {
            window.location.reload();
            return;
          }
          onRetry();
        }}
      >
        <span className={css.dot} aria-hidden />
        {rev ? <span className={css.rev}>{rev}</span> : null}
        <span className={css.label}>{stale ? "Refresh" : "Retry save"}</span>
      </button>
    );
  }

  if (status === "idle" && revision === 0 && savedTick === 0) {
    return null;
  }

  /*
   * Strict boolean — the UI renders exactly one state, never both.
   * isSaving = true  → spinner + "Saving"
   * isSaving = false → solid dot + "Saved Xm ago" / "vN Saved"
   */
  const isSaving = status === "saving" || status === "retrying";
  const label = isSaving
    ? status === "retrying"
      ? "Retrying"
      : "Saving"
    : ageLabel(savedTick, now);

  return (
    <button
      type="button"
      className={`${css.chip}${isSaving ? ` ${css.chipSaving}` : ""}${status === "saved" ? ` ${css.chipSaved}` : ""}`}
      data-testid="autosave-tick"
      data-status={status}
      aria-live="polite"
      aria-label={
        rev
          ? `${label}, canvas revision ${revision}`
          : label
      }
      title={
        isSaving
          ? "Autosaving…"
          : "Autosaved — click to save now"
      }
      disabled={isSaving}
      onClick={() => {
        if (!isSaving) onSave();
      }}
    >
      <span className={css.dot} aria-hidden />
      {rev ? <span className={css.rev}>{rev}</span> : null}
      <span className={css.label}>{label}</span>
    </button>
  );
}

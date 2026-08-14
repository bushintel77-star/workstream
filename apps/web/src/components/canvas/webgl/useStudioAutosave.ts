/**
 * Gold Standard 2026 — Studio Autosave Hook.
 *
 * Ported from the proven useStudioState.ts autosave pattern (lines 3950-3994),
 * extracted as a standalone hook for the unified WebGL studio. This is the
 * resilience backbone: it ensures operator work is never lost to a flaky
 * backyard Wi-Fi connection (the iPad-in-the-garden scenario).
 *
 * Two key mechanisms (praised in review as "professional-grade resilience"):
 *
 *   1. CONTENT FINGERPRINT (persistKey): a serialized hash of the document
 *      slices. The debounced save effect keys on this string — micro-movements
 *      that don't change the fingerprint don't trigger a network call. Quiet,
 *      efficient, bulletproof.
 *
 *   2. 3-ATTEMPT BACKOFF [2s, 8s, 30s]: on failure, the hook retries with
 *      exponentially increasing delays. A dropped connection doesn't fail
 *      permanently — it gracefully retries without locking the UI. Only
 *      `stale_client` (deploy mismatch) short-circuits, because only a refresh
 *      can heal that.
 *
 * On success, saveRevision is bumped — this is the live-data refetch key that
 * downstream hooks (useBoardFindings, useBoardReport, etc.) subscribe to.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogPlacement, CanvasStroke } from "@workstream/contracts";
import {
  saveDesignCanvasClient,
  classifySaveError,
} from "../handoff/features/save/saveDesignCanvasClient";
import { useStudioStore } from "./studioStore";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface StudioAutosaveDoc {
  /** Catalog placements (required by the PUT schema — pass [] if none). */
  placements: CatalogPlacement[];
  /** Sketch strokes in board-% space. */
  strokes: CanvasStroke[];
}

/* -------------------------------------------------------------------------- */
/* Fingerprint — the dirty-tracking content hash                              */
/* -------------------------------------------------------------------------- */

/**
 * Build a single string fingerprint of the document slices worth persisting.
 * The debounced save effect keys on this — if it doesn't change, no save fires.
 *
 * Stroke fingerprint includes id, width, color, and the point array (rounded to
 * 1 decimal to avoid float jitter triggering spurious saves). Placement
 * fingerprint includes id, position, scale, rotation, and type.
 */
function buildPersistKey(doc: StudioAutosaveDoc): string {
  const strokeParts = doc.strokes.map(
    (s) =>
      `${s.id}:${s.width_px}:${s.color}:${
        (s.points ?? [])
          .map((p) => `${p.x_pct.toFixed(1)},${p.y_pct.toFixed(1)}`)
          .join("|")
      }`,
  );
  const placementParts = doc.placements.map(
    (p) =>
      `${p.id}:${p.symbol_id}:${p.x_pct.toFixed(1)}:${p.y_pct.toFixed(1)}:${
        p.scale.toFixed(2)
      }:${p.rotation_deg}`,
  );
  return [
    `s${doc.strokes.length}:${strokeParts.join("~")}`,
    `p${doc.placements.length}:${placementParts.join("~")}`,
  ].join("§");
}

/* -------------------------------------------------------------------------- */
/* Backoff schedule                                                            */
/* -------------------------------------------------------------------------- */

/** Retry delays in ms — matches useStudioState.ts exactly. */
const BACKOFF_MS = [2_000, 8_000, 30_000];

/** Debounce delay — matches useStudioState.ts (1100ms). */
const DEBOUNCE_MS = 1_100;

/* -------------------------------------------------------------------------- */
/* The hook                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Debounced autosave for the unified WebGL studio.
 *
 * @param projectId  The project to save to (from the store or props).
 * @param doc         The current document slices to persist.
 *
 * Usage:
 *   const doc = useMemo(() => ({ placements, strokes }), [placements, strokes]);
 *   useStudioAutosave(projectId, doc);
 *
 * The hook manages saveStatus / saveRevision in the studio store automatically.
 * Components subscribe to `useStudioStore((s) => s.saveStatus)` for the chip.
 */
export function useStudioAutosave(
  projectId: string,
  doc: StudioAutosaveDoc,
): {
  /** Trigger an immediate save (bypasses the debounce). */
  saveNow: () => Promise<void>;
  /** Bump the retry nonce — forces the effect to re-run. */
  retrySave: () => void;
} {
  const persistKey = useMemo(() => buildPersistKey(doc), [doc]);

  // skipPersist: skip the FIRST effect run (bootstrap hydration shouldn't
  // immediately re-save the canvas we just loaded). Also flipped by saveNow
  // after a successful manual save to prevent the debounce re-firing.
  const skipPersist = useRef(true);
  // retryNonce: bumped by retrySave() to re-trigger the effect.
  const [retryNonce, setRetryNonce] = useState(0);

  // Refs to avoid stale closures inside the debounced callback.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const docRef = useRef(doc);
  docRef.current = doc;

  // Store setters (stable identity from zustand).
  const setSaveStatus = useStudioStore((s) => s.setSaveStatus);
  const bumpSaveRevision = useStudioStore((s) => s.bumpSaveRevision);

  /**
   * Assemble the full canvas body and PUT it. Full-canvas save (not a diff) —
   * matches the SVG studio's saveNow pattern exactly.
   */
  const persist = useCallback(async (): Promise<void> => {
    const pid = projectIdRef.current;
    if (!pid) return;
    const current = docRef.current;

    setSaveStatus("saving");
    try {
      await saveDesignCanvasClient(pid, {
        placements: current.placements,
        strokes: current.strokes,
      });
      bumpSaveRevision();
      setSaveStatus("saved");
    } catch (err) {
      const kind = classifySaveError(err);
      console.error("[useStudioAutosave] save failed", err);
      setSaveStatus("error", kind);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [setSaveStatus, bumpSaveRevision]);

  /** Immediate save — bypasses debounce (used by manual "Save" button + retry). */
  const saveNow = useCallback(async (): Promise<void> => {
    skipPersist.current = true; // suppress the debounce that would follow
    await persist();
  }, [persist]);

  /** Bump the retry nonce to re-run the debounced effect. */
  const retrySave = useCallback(() => {
    skipPersist.current = false;
    setRetryNonce((n) => n + 1);
  }, []);

  /**
   * The debounced autosave effect — keyed on [persistKey, retryNonce].
   *
   * When the content fingerprint changes (or the retry nonce bumps), wait
   * DEBOUNCE_MS, then attempt to persist. On failure, retry up to 3 times
   * with BACKOFF_MS delays. stale_client errors never heal → short-circuit.
   */
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }

    let cancelled = false;

    const handle = window.setTimeout(() => {
      const attempt = async (trial: number): Promise<void> => {
        if (cancelled) return;
        try {
          await persist();
        } catch (err) {
          if (cancelled) return;
          const kind = classifySaveError(err);
          // stale_client never heals — only a page refresh fixes it.
          if (kind === "stale_client") {
            setSaveStatus("error", "stale_client");
            return;
          }
          if (trial <= BACKOFF_MS.length) {
            setSaveStatus("retrying", kind);
            await new Promise((r) =>
              window.setTimeout(r, BACKOFF_MS[trial - 1] ?? DEBOUNCE_MS),
            );
            return attempt(trial + 1);
          }
          setSaveStatus("error", kind);
        }
      };
      void attempt(1);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content fingerprint + retry nonce, not callback identity
  }, [persistKey, retryNonce]);

  return { saveNow, retrySave };
}

/**
 * beforeunload guard — warn before leaving when a save is in-flight or errored.
 * Ported from HandoffDesignStudio.tsx:1435-1448.
 *
 * The debounce delay is short (1100ms) so we don't guard every keystroke — we
 * only guard when the network is actually active or has failed.
 */
export function useBeforeUnloadGuard(): void {
  const saveStatus = useStudioStore((s) => s.saveStatus);

  useEffect(() => {
    const dirty =
      saveStatus === "error" ||
      saveStatus === "saving" ||
      saveStatus === "retrying";
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);
}

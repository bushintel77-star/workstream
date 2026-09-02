"use client";

/**
 * StudioCanvasLoading — canvas-first loading surface (Studio Paper).
 *
 * The WebGL mount used to paint a flat `--gs-canvas` void while the studio
 * chunk resolved (and again, silently, while the site-truth bootstrap parsed
 * the Vicmap cadastral data on first load) — an operator-facing blank page
 * with no feedback. This replaces that void with a single honest status
 * surface: a frosted paper card floating on the canvas base, a status line,
 * and a progress readout.
 *
 * Two modes:
 *   - No `stages`: an indeterminate ring (used for the brief WebGL chunk
 *     load, where the pipeline is a single opaque fetch).
 *   - With `stages`: a BOUNDED stage ladder. It advances through the real
 *     pipeline steps and stops on the last one, filling a linear progress
 *     bar 1..N — it never spins forever. Completion (unmount) is the
 *     parent's job once the work resolves; a client watchdog guarantees the
 *     surface cannot persist past a bounded window.
 *
 * Colour discipline: ink on paper only (no raw hex, no hue-only signal). The
 * card is the single `role="status"` live region; assistive tech hears the
 * current stage as it advances. Reduced motion drops the ring animation and
 * shows the first stage statically.
 */

import { useEffect, useState } from "react";
import s from "./StudioCanvasLoading.module.css";

export interface StudioCanvasLoadingProps {
  /** Status line — announced to assistive tech and shown under the ring. */
  label?: string;
  /** Optional secondary line (e.g. the site being located). */
  detail?: string;
  /** Real pipeline stages — when supplied, the loader is a bounded ladder. */
  stages?: string[];
  /** data-testid passthrough for e2e. */
  testId?: string;
}

/** Total time to walk the stage ladder (ms) — bounded, never infinite.
 *  Sized under the caller's 12 s watchdog so a slow import spends little time
 *  parked on the final stage with a full bar. */
const STAGE_TOTAL_MS = 8000;

export function StudioCanvasLoading({
  label = "Loading canvas",
  detail,
  stages,
  testId = "studio-canvas-loading",
}: StudioCanvasLoadingProps) {
  const stageCount = stages?.length ?? 0;
  // Bounded stage ladder — advances to the last stage and stops. The parent
  // unmounts on completion, so "done" lives with the caller.
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (stageCount <= 1) return;
    const timers: number[] = [];
    for (let i = 1; i < stageCount; i++) {
      timers.push(
        window.setTimeout(() => setStageIndex(i), (i * STAGE_TOTAL_MS) / stageCount),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [stageCount]);

  const currentStage = stageCount > 0 ? stages![Math.min(stageIndex, stageCount - 1)] : undefined;
  // Bounded readout — 1..N of N, so the bar reaches 100% on the last stage.
  const progress = stageCount > 0 ? ((Math.min(stageIndex, stageCount - 1) + 1) / stageCount) * 100 : 0;
  const announced = currentStage ?? label;

  return (
    <div
      className={s.root}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={announced}
    >
      <div className={s.card}>
        <span className={s.label}>{label}</span>

        {currentStage ? (
          <>
            <span className={s.stageCurrent} data-stage={currentStage}>
              {currentStage}
            </span>
            <div
              className={s.progress}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label={`${label} — ${currentStage}`}
            >
              <div className={s.progressBar} style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <span className={s.ring} aria-hidden />
        )}

        {detail ? <span className={s.detail}>{detail}</span> : null}
      </div>
    </div>
  );
}

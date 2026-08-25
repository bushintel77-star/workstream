"use client";

/**
 * AiScanOverlay — the AI parsing-stage transition for geospatial work.
 *
 * Applied from the AI-vision scanning research: a parsing period is not a
 * spinner moment, it is a trust-building window. The overlay visualises the
 * interrogation of the site in four phases — contextual muting (linen veil),
 * a sweeping scan beam (compositor-only transform), a progressive sage reveal
 * clipped to the swept region, and staged "agent action review" micro-labels
 * so the operator reads WHAT the model is doing, not just that it is busy.
 *
 * Colour discipline: the canopy-sage beam keeps the LA material palette and
 * never relies on hue alone — the staged labels carry the state verbally.
 * Accessibility: decorative layers are aria-hidden; the host renders exactly
 * one role="status" live region per overlay instance. Reduced motion drops
 * the sweep theatre and keeps the veil + first stage statically.
 *
 * Mount cost when inactive: null. All styling lives in the CSS module — no
 * inline values (off-scale scan) and no raw hex (colour gate).
 */

import s from "./AiScanOverlay.module.css";

export interface AiScanOverlayProps {
  /** While true the overlay runs; false unmounts everything. */
  active: boolean;
  /** Primary status line announced to assistive tech and shown beside the pulse dot. */
  label: string;
  /** Agent-action-review stages cycled while the scan runs (Phase 4). */
  stages?: string[];
  /** data-testid passthrough for e2e. */
  testId?: string;
  /**
   * Optional per-stage testids (`scan-stage-<name>`) — supplied when the
   * stages come from a real choreography so e2e can assert the true order.
   */
  stageTestIds?: string[];
}

/** Shared cycle length for the stage track (ms) — one slice per stage. */
const STAGE_CYCLE_MS = 6000;

export function AiScanOverlay({
  active,
  label,
  stages = [],
  testId = "ai-scan-overlay",
  stageTestIds,
}: AiScanOverlayProps) {
  if (!active) return null;

  const cycle = `${STAGE_CYCLE_MS}ms`;

  return (
    <div
      className={s.root}
      data-testid={testId}
      data-graphic-transition="ai-site-parse"
      data-api-neutral="true"
      aria-label={label}
    >
      {/* Phases 1–3: muting veil, sage reveal, scanning beam. Decorative. */}
      <div className={s.veil} aria-hidden />
      <div className={s.reveal} aria-hidden />
      <div className={s.beam} aria-hidden />

      {/* Phase 4: agent action review — the only live region. */}
      <div className={s.stages} role="status" aria-live="polite">
        <span className={s.transitionMark} aria-hidden>
          <span className={s.transitionMarkLine} />
          <span className={s.transitionMarkNode} />
          <span className={s.transitionMarkLine} />
        </span>
        <span className={s.pulseDot} aria-hidden />
        {stages.length > 0 ? (
          <span className={s.stageTrack} style={{ ["--scan-cycle" as string]: cycle }}>
            {stages.map((stage, i) => (
              <span
                key={stage}
                className={s.stage}
                data-testid={stageTestIds?.[i]}
                style={{ animationDelay: `${(i * STAGE_CYCLE_MS) / stages.length}ms` }}
              >
                {stage}
              </span>
            ))}
          </span>
        ) : (
          <span>{label}</span>
        )}
      </div>
    </div>
  );
}

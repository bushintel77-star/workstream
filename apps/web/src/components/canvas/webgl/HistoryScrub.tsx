"use client";

/**
 * Phase P — History scrub (spec §8a).
 *
 * A segmented session track that scrubs through the undo/redo history with
 * the finger — 1:1, zero easing. Segmented by activity (survey / grading /
 * paving / planting / markup). Ghost-ahead compare shows what would change
 * if the head were released at the current position. Volume delta readout
 * (then vs delta now).
 *
 * Branch-on-edit: releasing the head with work ahead offers a branch —
 * never a silent overwrite.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase P.
 * Reference: README §8a.
 */

import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import styles from "./HistoryScrub.module.css";

/** Activity segments — the spec's named activity types. */
export type ActivitySegment = "survey" | "grading" | "paving" | "planting" | "markup";

const SEGMENT_LABEL: Record<ActivitySegment, string> = {
  survey: "Survey",
  grading: "Grading",
  paving: "Paving",
  planting: "Planting",
  markup: "Markup",
};

const SEGMENT_COLOR: Record<ActivitySegment, string> = {
  survey: "var(--gs-truth)",
  grading: "var(--gs-conflict)",
  paving: "var(--lc-ink)",
  planting: "var(--lc-accent-terrain)",
  markup: "var(--lc-accent-redline)",
};

export function HistoryScrub() {
  const historyPast = useStudioStore((s) => s.historyPast);
  const historyFuture = useStudioStore((s) => s.historyFuture);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const [scrubIdx, setScrubIdx] = useState<number>(-1); // -1 = live (head)
  const [branchOffer, setBranchOffer] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Total history length: past + current (live) + future
  const totalSteps = historyPast.length + 1 + historyFuture.length;
  const liveIdx = historyPast.length; // the live (current) position

  // When scrubbing, we step through history. -1 means "at live head".
  const currentIdx = scrubIdx === -1 ? liveIdx : scrubIdx;

  // Reset scrub when history changes (new commit)
  useEffect(() => {
    setScrubIdx(-1);
    setBranchOffer(false);
  }, [historyPast.length, historyFuture.length]);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateScrubFromPointer(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return;
    updateScrubFromPointer(e.clientX);
  }

  function handlePointerUp(_e: React.PointerEvent) {
    // Branch-on-edit: if we released behind the head and there's work ahead,
    // offer a branch instead of silently overwriting.
    if (scrubIdx !== -1 && scrubIdx < liveIdx && historyFuture.length > 0) {
      setBranchOffer(true);
    } else {
      // Releasing at or ahead of the head: apply the scrub
      applyScrub();
    }
  }

  function updateScrubFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const idx = Math.round(Math.max(0, Math.min(1, pct)) * (totalSteps - 1));
    setScrubIdx(idx);
  }

  function applyScrub() {
    if (scrubIdx === -1 || scrubIdx === liveIdx) return;
    // Step undo/redo to reach the target index
    const steps = scrubIdx - liveIdx;
    if (steps < 0) {
      for (let i = 0; i < -steps; i++) undo();
    } else {
      for (let i = 0; i < steps; i++) redo();
    }
    setScrubIdx(-1);
  }

  function handleBranchAccept() {
    // Accept the branch: apply the scrub (the future becomes a branch)
    applyScrub();
    setBranchOffer(false);
  }

  function handleBranchDismiss() {
    // Dismiss: return to the live head
    setScrubIdx(-1);
    setBranchOffer(false);
  }

  // Segment widths — evenly distributed for now (real segmentation would
  // tag each history entry with its activity type)
  const segments: ActivitySegment[] = ["survey", "grading", "paving", "planting", "markup"];

  return (
    <div className={styles.container} data-testid="history-scrub">
      <div className={styles.header}>
        <span className={styles.label}>History</span>
        <span className={styles.count}>
          {currentIdx + 1} / {totalSteps}
        </span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-label="History scrub"
        aria-valuemin={0}
        aria-valuemax={totalSteps - 1}
        aria-valuenow={currentIdx}
        tabIndex={0}
      >
        {/* Segment backgrounds */}
        {segments.map((seg, i) => (
          <div
            key={seg}
            className={styles.segment}
            style={{
              background: SEGMENT_COLOR[seg],
              opacity: 0.15 + (i / segments.length) * 0.1,
            }}
            title={SEGMENT_LABEL[seg]}
          />
        ))}
        {/* Step ticks */}
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`${styles.tick} ${i === currentIdx ? styles.tickActive : ""}`}
            style={{ left: `${(i / Math.max(1, totalSteps - 1)) * 100}%` }}
          />
        ))}
        {/* Ghost-ahead compare: show the future as a faint overlay */}
        {historyFuture.length > 0 && scrubIdx !== -1 && scrubIdx < liveIdx && (
          <div
            className={styles.ghostAhead}
            style={{
              left: `${(scrubIdx / Math.max(1, totalSteps - 1)) * 100}%`,
              width: `${((liveIdx - scrubIdx) / Math.max(1, totalSteps - 1)) * 100}%`,
            }}
            title="Ghost-ahead: work that would be lost if you branch here"
          />
        )}
      </div>
      {branchOffer && (
        <div className={styles.branchOffer} data-testid="branch-offer">
          <span className={styles.branchText}>
            Release here and {historyFuture.length} step{historyFuture.length === 1 ? "" : "s"} of work ahead will branch — not overwrite.
          </span>
          <button className={styles.branchBtn} onClick={handleBranchAccept} data-action="branch-accept">
            Branch
          </button>
          <button className={styles.branchBtn} onClick={handleBranchDismiss} data-action="branch-dismiss">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Phase P — History scrub (spec §8a).
 *
 * A segmented session track that scrubs through the undo/redo history with
 * the finger — 1:1, zero easing. Segmented by activity (survey / grading /
 * paving / planting / markup), derived from the history itself in
 * `historySegments.ts`. Ghost-ahead compare shows what would be branched
 * away if the head were released at the current position.
 *
 * Branch-on-edit: releasing the head with work ahead offers a branch —
 * never a silent overwrite.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase P.
 * Reference: README §8a.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  SEGMENT_COLOR,
  SEGMENT_LABEL,
  activityAt,
  buildHistorySegments,
  type HistorySnapshotSlice,
} from "./historySegments";
import styles from "./HistoryScrub.module.css";

export function HistoryScrub() {
  const historyPast = useStudioStore((s) => s.historyPast);
  const historyFuture = useStudioStore((s) => s.historyFuture);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  // The live document, shaped like a snapshot, so it can sit between past
  // and future as the middle step of the track.
  const liveSlice = useStudioStore(
    (s): HistorySnapshotSlice => ({
      placements: s.placements,
      strokes: s.sketchStrokes,
      photoElevations: s.photoElevations,
      features: s.features,
      constructionTrenches: s.constructionTrenches,
      irrigationZones: s.irrigationZones,
      canvases: s.sketchCanvases,
      setbackLines: s.setbackLines,
      buildingFootprints: s.buildingFootprints,
    }),
  );
  const [scrubIdx, setScrubIdx] = useState<number>(-1); // -1 = live (head)
  const [branchOffer, setBranchOffer] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Total history length: past + current (live) + future
  const totalSteps = historyPast.length + 1 + historyFuture.length;
  const liveIdx = historyPast.length; // the live (current) position

  // When scrubbing, we step through history. -1 means "at live head".
  const currentIdx = scrubIdx === -1 ? liveIdx : scrubIdx;

  // Real segmentation: the bands come from diffing consecutive document
  // states, so a run of grading steps draws as one grading band of the
  // right width. Five fixed equal bands used to be drawn regardless of what
  // the session contained.
  const segments = useMemo(
    () => buildHistorySegments([...historyPast, liveSlice, ...historyFuture]),
    [historyPast, liveSlice, historyFuture],
  );
  const currentActivity = activityAt(segments, currentIdx);

  // Reset scrub when history changes (new commit)
  useEffect(() => {
    setScrubIdx(-1);
    setBranchOffer(false);
  }, [historyPast.length, historyFuture.length]);

  function handlePointerDown(e: React.PointerEvent) {
    // Capture on the TRACK, not the pressed child: the ticks and bands
    // re-render as the history changes, and capture on a node that unmounts
    // mid-drag drops the gesture.
    e.currentTarget.setPointerCapture(e.pointerId);
    updateScrubFromPointer(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return;
    updateScrubFromPointer(e.clientX);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    commitScrub();
  }

  function commitScrub() {
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

  /**
   * Keyboard operation. The track carries `role="slider"` and takes focus,
   * so it has to be operable from the keyboard — it used to be focusable
   * and inert, which is worse than not being focusable at all.
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    const step = (delta: number) => {
      e.preventDefault();
      setScrubIdx((prev) => {
        const from = prev === -1 ? liveIdx : prev;
        return Math.max(0, Math.min(totalSteps - 1, from + delta));
      });
    };
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        return step(-1);
      case "ArrowRight":
      case "ArrowUp":
        return step(1);
      case "PageDown":
        return step(-5);
      case "PageUp":
        return step(5);
      case "Home":
        e.preventDefault();
        return setScrubIdx(0);
      case "End":
        e.preventDefault();
        return setScrubIdx(totalSteps - 1);
      case "Enter":
      case " ":
        e.preventDefault();
        return commitScrub();
      case "Escape":
        e.preventDefault();
        setScrubIdx(-1);
        setBranchOffer(false);
        return;
      default:
        return;
    }
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

  return (
    <div className={styles.container} data-testid="history-scrub">
      <div className={styles.header}>
        <span className={styles.label}>History</span>
        <span className={styles.count} data-activity={currentActivity ?? undefined}>
          {currentActivity ? `${SEGMENT_LABEL[currentActivity]} · ` : ""}
          {currentIdx + 1} / {totalSteps}
        </span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="History scrub"
        aria-valuemin={0}
        aria-valuemax={totalSteps - 1}
        aria-valuenow={currentIdx}
        aria-valuetext={
          currentActivity
            ? `${SEGMENT_LABEL[currentActivity]}, step ${currentIdx + 1} of ${totalSteps}`
            : `Step ${currentIdx + 1} of ${totalSteps}`
        }
        tabIndex={0}
      >
        {/* Activity bands — width proportional to the steps each run covers */}
        {segments.map((seg) => (
          <div
            key={`${seg.activity}-${seg.startIdx}`}
            className={styles.segment}
            data-activity={seg.activity}
            style={{
              left: `${(seg.startIdx / totalSteps) * 100}%`,
              width: `${(seg.steps / totalSteps) * 100}%`,
              background: SEGMENT_COLOR[seg.activity],
            }}
            title={`${SEGMENT_LABEL[seg.activity]} · ${seg.steps} step${seg.steps === 1 ? "" : "s"}`}
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

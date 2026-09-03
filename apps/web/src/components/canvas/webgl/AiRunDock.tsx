"use client";

/**
 * Phase S — AI run dock (spec §18b).
 *
 * Lives on the camera dock beside the time pill. No prompt box. The drawing
 * is the prompt. Shows staged progress, inputs with counts, and a scrub
 * slider for the derived view. Two permanent refusals are stated plainly.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase S.
 */

import { useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  IDLE_RUN,
  RUN_STAGES,
  buildRunInputs,
  startRun,
  updateStageProgress,
  completeRun,
  setScrubPosition,
  REFUSAL_UNSPECIFIED_BED,
  REFUSAL_NO_GEOMETRY_WRITE,
  INDICATIVE_STAMP,
  type AiRunState,
} from "./aiRun";
import styles from "./AiRunDock.module.css";

export function AiRunDock() {
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);
  const sunMin = useStudioStore((s) => s.sunMin);
  const growthYear = useStudioStore((s) => s.growthYear);
  const [run, setRun] = useState<AiRunState>(IDLE_RUN);
  const [expanded, setExpanded] = useState(false);

  function handleStart() {
    const inputs = buildRunInputs({
      placementCount: placements.length,
      featureCount: features.length,
      materialCount: 0,
      speciesCount: 0,
      sunTime: `${Math.floor(sunMin / 60)}:${String(sunMin % 60).padStart(2, "0")}`,
      growthYear,
    });
    setRun(startRun(inputs));
    setExpanded(true);
    // Simulate staged progress (the real implementation would call the API)
    simulateRun();
  }

  function simulateRun() {
    let stageIdx = 0;
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      if (progress >= 1) {
        stageIdx++;
        progress = 0;
        if (stageIdx >= RUN_STAGES.length) {
          clearInterval(interval);
          setRun((r) => completeRun(r));
          return;
        }
      }
      setRun((r) => updateStageProgress(r, stageIdx, progress, 500));
    }, 200);
  }

  function handleScrub(value: number) {
    setRun((r) => setScrubPosition(r, value));
  }

  const isRunning = run.status === "running";
  const isComplete = run.status === "complete";

  return (
    <div className={styles.container} data-testid="ai-run-dock">
      <button
        className={styles.runButton}
        onClick={handleStart}
        disabled={isRunning}
        data-testid="ai-run-start"
        data-running={isRunning ? "true" : undefined}
        title="Run an AI render from the current drawing. No prompt — the drawing is the prompt."
      >
        {isRunning ? "RUNNING" : "AI RUN"}
      </button>
      {(isRunning || isComplete || expanded) && (
        <div className={styles.panel} data-testid="ai-run-panel">
          {/* S.2 — inputs stated with counts */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Inputs (from the file)</div>
            {run.inputs.map((input) => (
              <div key={input.kind} className={styles.inputRow}>
                <span className={styles.inputLabel}>{input.label}</span>
                <span className={styles.inputCount}>{input.count}</span>
              </div>
            ))}
          </div>

          {/* S.3 — staged progress */}
          {isRunning && (
            <div className={styles.section} data-testid="ai-run-stages">
              <div className={styles.sectionTitle}>Progress</div>
              {run.stages.map((stage) => (
                <div
                  key={stage.id}
                  className={styles.stageRow}
                  data-stalled={stage.stalled ? "true" : undefined}
                >
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <div className={styles.stageBar}>
                    <div
                      className={styles.stageFill}
                      style={{ width: `${stage.progress * 100}%` }}
                    />
                  </div>
                  <span className={styles.stageStatus}>
                    {stage.stalled ? "STALLED" : stage.progress >= 1 ? "DONE" : `${Math.round(stage.progress * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* S.5 — scrub slider */}
          {isComplete && (
            <div className={styles.section} data-testid="ai-run-scrub">
              <div className={styles.sectionTitle}>Render scrub</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={run.scrubPosition}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
                className={styles.scrubSlider}
                data-testid="ai-scrub-slider"
              />
              <div className={styles.scrubLabels}>
                <span>Ink</span>
                <span>Render</span>
              </div>
            </div>
          )}

          {/* S.6 + S.7 — permanent refusals */}
          <div className={styles.refusals} data-testid="ai-run-refusals">
            <div className={styles.refusal}>{REFUSAL_UNSPECIFIED_BED}</div>
            <div className={styles.refusal}>{REFUSAL_NO_GEOMETRY_WRITE}</div>
          </div>

          {/* S.8 — indicative stamp */}
          {isComplete && (
            <div className={styles.stamp} data-testid="ai-run-stamp">
              {INDICATIVE_STAMP}
            </div>
          )}

          {/* S.9 — stale notice */}
          {run.stale && (
            <div className={styles.staleNotice} data-testid="ai-run-stale">
              Render is stale: {run.staleReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

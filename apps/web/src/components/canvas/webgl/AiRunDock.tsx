"use client";

/**
 * Phase S — AI run dock (spec §18b).
 *
 * Lives on the camera dock beside the time pill. No prompt box. The drawing
 * is the prompt: the dock states the inputs it would read, straight from the
 * file, with their real counts.
 *
 * WHAT THIS DOCK DOES NOT DO: run. There is no render service behind it —
 * no route in `apps/api/src/routes` serves one. It used to fake the run
 * outright: `simulateRun()` drove a `setInterval` through seven stages with
 * no request of any kind, then marked the run COMPLETE, stamped the result
 * "indicative render" and offered an ink-to-render scrub slider over a
 * render that did not exist. It also reported "Materials 0 · Species 0"
 * every time, because those counts were hardcoded zeros.
 *
 * A control that reports work it never did is worse than no control (§0.1,
 * never ship a dead control). So the dock states the inputs — which is true
 * and useful — and states plainly that the run is not connected. The staged
 * progress model in `aiRun.ts` is real and tested; it stays, unused, for the
 * day a service exists to drive it.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase S.
 */

import { useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  buildRunInputs,
  REFUSAL_UNSPECIFIED_BED,
  REFUSAL_NO_GEOMETRY_WRITE,
} from "./aiRun";
import { materialById } from "./materials";
import styles from "./AiRunDock.module.css";

/** Stated where the operator can see it, not buried in a tooltip. */
const NOT_CONNECTED =
  "No render service is configured, so this run cannot be started. Nothing here is a render.";

export function AiRunDock() {
  const placements = useStudioStore((s) => s.placements);
  const features = useStudioStore((s) => s.features);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const sunMin = useStudioStore((s) => s.sunMin);
  const growthYear = useStudioStore((s) => s.growthYear);
  const [expanded, setExpanded] = useState(false);

  const inputs = useMemo(() => {
    // Real counts, read from the file. Species is the number of DISTINCT
    // catalog symbols actually placed — the schedule's own definition — not
    // the placement count, and never a hardcoded zero.
    const species = new Set(placements.map((p) => p.symbol_id)).size;
    const materials = new Set(
      strokes
        .map((s) => s.material)
        .filter((id): id is string => Boolean(id && materialById(id))),
    ).size;
    return buildRunInputs({
      placementCount: placements.length,
      featureCount: features.length,
      materialCount: materials,
      speciesCount: species,
      sunTime: `${Math.floor(sunMin / 60)}:${String(sunMin % 60).padStart(2, "0")}`,
      growthYear,
    });
  }, [placements, features, strokes, sunMin, growthYear]);

  return (
    <div className={styles.container} data-testid="ai-run-dock">
      <button
        className={styles.runButton}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid="ai-run-start"
        data-available="false"
        title={NOT_CONNECTED}
      >
        AI RUN
      </button>
      {expanded && (
        <div className={styles.panel} data-testid="ai-run-panel">
          {/* The refusal that matters most: it cannot run at all. Stated
              first, before the inputs, so the panel is never mistaken for a
              result. */}
          <div className={styles.unavailable} data-testid="ai-run-unavailable">
            {NOT_CONNECTED}
          </div>

          {/* S.2 — inputs stated with counts. True whether or not a service
              exists: this is what a run WOULD read from the drawing. */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Inputs a run would read (from the file)
            </div>
            {inputs.map((input) => (
              <div key={input.kind} className={styles.inputRow}>
                <span className={styles.inputLabel}>{input.label}</span>
                <span className={styles.inputCount}>{input.count}</span>
              </div>
            ))}
          </div>

          {/* S.6 + S.7 — permanent refusals */}
          <div className={styles.refusals} data-testid="ai-run-refusals">
            <div className={styles.refusal}>{REFUSAL_UNSPECIFIED_BED}</div>
            <div className={styles.refusal}>{REFUSAL_NO_GEOMETRY_WRITE}</div>
          </div>
        </div>
      )}
    </div>
  );
}

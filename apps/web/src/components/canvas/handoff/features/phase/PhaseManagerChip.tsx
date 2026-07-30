"use client";

import { useEffect, useState } from "react";
import {
  DESIGN_LIFECYCLE_LABEL,
  DESIGN_LIFECYCLE_PHASES,
  resolvePhaseCapabilities,
  type DesignLifecyclePhase,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./phaseManager.module.css";

type Props = {
  phase: DesignLifecyclePhase;
  onPhase: (phase: DesignLifecyclePhase) => void;
};

/** Short frost-chip labels — full names live in the tip. */
const PHASE_CHIP_SHORT: Record<DesignLifecyclePhase, string> = {
  concept: "Concept",
  design_development: "Design",
  construction_docs: "Docs",
  tendering: "Tender",
  construction_admin: "Admin",
  post_occupancy: "Occupancy",
};

/**
 * Summonable ASLA/SILA lifecycle chip — collapsed by default (canvas-first).
 * Expand for phase picks; tip only while open. CameraChrome dock only.
 */
export function PhaseManagerChip({ phase, onPhase }: Props) {
  const [open, setOpen] = useState(false);
  const caps = resolvePhaseCapabilities(phase);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={40} testId="phase-manager-chrome">
      <aside
        className={css.chip}
        data-testid="phase-manager"
        data-phase={phase}
        data-open={open ? "1" : "0"}
      >
        <button
          type="button"
          className={css.summary}
          data-testid="phase-manager-toggle"
          aria-expanded={open}
          aria-controls="ws-lifecycle-phase-group"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={css.label}>Phase</span>
          <span className={css.summaryValue}>{PHASE_CHIP_SHORT[phase]}</span>
        </button>
        {open ? (
          <>
            <div
              id="ws-lifecycle-phase-group"
              className={css.chipRow}
              role="radiogroup"
              aria-label="Design lifecycle phase"
              data-testid="phase-manager-select"
            >
              {DESIGN_LIFECYCLE_PHASES.map((p) => {
                const on = p === phase;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={css.phaseChip}
                    data-on={on ? "1" : "0"}
                    data-testid={`phase-chip-${p}`}
                    title={DESIGN_LIFECYCLE_LABEL[p]}
                    onClick={() => {
                      onPhase(p);
                      setOpen(false);
                    }}
                  >
                    {PHASE_CHIP_SHORT[p]}
                  </button>
                );
              })}
            </div>
            <p className={css.tip}>{caps.tip}</p>
          </>
        ) : null}
      </aside>
    </CameraChrome>
  );
}

"use client";

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

/**
 * Summonable ASLA/SILA lifecycle chip — soft expected-detail tip, not a tool lock.
 * Mounted via CameraChrome so it never scales with the board.
 */
export function PhaseManagerChip({ phase, onPhase }: Props) {
  const caps = resolvePhaseCapabilities(phase);

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={40} testId="phase-manager-chrome">
      <aside className={css.chip} data-testid="phase-manager" data-phase={phase}>
        <label className={css.label} htmlFor="ws-lifecycle-phase">
          Phase
        </label>
        <select
          id="ws-lifecycle-phase"
          className={css.select}
          value={phase}
          data-testid="phase-manager-select"
          onChange={(e) => onPhase(e.target.value as DesignLifecyclePhase)}
        >
          {DESIGN_LIFECYCLE_PHASES.map((p) => (
            <option key={p} value={p}>
              {DESIGN_LIFECYCLE_LABEL[p]}
            </option>
          ))}
        </select>
        <p className={css.tip}>{caps.tip}</p>
      </aside>
    </CameraChrome>
  );
}

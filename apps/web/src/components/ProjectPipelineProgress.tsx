"use client";

import s from "../styles/app.module.css";
import pp from "./pipelineProgress.module.css";

export type PipelineStage = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
};

export function buildPipelineStages(args: {
  hasTranscript: boolean;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  hasAudit: boolean;
  status: string | null;
}): PipelineStage[] {
  const order = [
    { key: "transcript", label: "Transcribing walkthrough", done: args.hasTranscript },
    { key: "survey", label: "Surveying site", done: args.hasSurvey },
    { key: "design", label: "Generating design", done: args.hasDesign },
    { key: "costing", label: "Costing scenarios", done: args.hasCosting },
    { key: "audit", label: "Self-audit", done: args.hasAudit },
  ];
  const firstOpen = order.findIndex((x) => !x.done);
  return order.map((row, i) => ({
    ...row,
    active: i === firstOpen && args.status === "processing",
  }));
}

type Props = {
  stages: PipelineStage[];
  slow?: boolean;
  error?: string | null;
  onRetry?: () => void;
  compact?: boolean;
};

export function ProjectPipelineProgress({
  stages,
  slow = false,
  error = null,
  onRetry,
  compact = false,
}: Props) {
  return (
    <div
      className={compact ? pp.wrapCompact : pp.wrap}
      role="status"
      aria-live="polite"
      aria-busy={stages.some((s) => s.active)}
    >
      <ul className={pp.stages}>
        {stages.map((stage) => (
          <li key={stage.key} className={pp.stageRow}>
            <span
              className={`${pp.dot} ${stage.done ? pp.dotDone : ""} ${stage.active ? pp.dotActive : ""}`}
              aria-hidden
            />
            <span
              className={`${pp.label} ${stage.done ? pp.labelDone : ""} ${stage.active ? pp.labelActive : ""}`}
            >
              {stage.label}
              {stage.active ? "…" : stage.done ? " ✓" : ""}
            </span>
          </li>
        ))}
      </ul>

      {stages.some((s) => s.active) && (
        <p className={pp.working}>Working — stay on this screen.</p>
      )}

      {slow && (
        <p className={pp.slow}>
          Still working. Large sites or a cold server can take a few minutes.
        </p>
      )}

      {error && (
        <div className={s.error}>
          {error}
          {onRetry && (
            <button type="button" className={`${s.btnGhost} ${pp.retry}`} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restartPipelineAction } from "../../../actions";
import { useToast } from "../../../../components/ToastHost";
import { KitButton } from "../../../../components/ui/kit";
import type { ProjectStatus } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import styles from "../project.module.css";

type StageKey = "transcribe" | "survey" | "design" | "costing" | "audit";

type Stage = {
  key: StageKey;
  label: string;
  description: string;
};

type PipelineProgress = {
  status: ProjectStatus;
  hasTranscript: boolean;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  hasAudit: boolean;
  ready: boolean;
} | null;

const STAGES: Stage[] = [
  {
    key: "transcribe",
    label: "TRANSCRIBE",
    description: "Voice walkthrough is converted to structured notes.",
  },
  {
    key: "survey",
    label: "SURVEY",
    description: "AI extracts title, house, garden, and access facts.",
  },
  {
    key: "design",
    label: "DESIGN",
    description: "Curtis house-style proposal is drafted.",
  },
  {
    key: "costing",
    label: "COSTING",
    description: "Rate-card quantities and GST totals are calculated.",
  },
  {
    key: "audit",
    label: "AUDIT",
    description: "Risks, permit prompts, and handoff checks are reviewed.",
  },
];

/* Pipeline failure states land here: which stage index failed. The API's
 * capture-pipeline writes these; without this map they used to render as
 * "still processing" until a generic timeout. */
const FAILED_STAGE_INDEX: Partial<Record<ProjectStatus, number>> = {
  transcription_failed: 0,
  survey_failed: 1,
  design_failed: 2,
  costing_failed: 3,
  audit_failed: 4,
  outputs_failed: 5,
};

function completedCountFor(status: ProjectStatus): number {
  const failedAt = FAILED_STAGE_INDEX[status];
  if (failedAt != null) return failedAt;
  if (status === "transcribed") return 1;
  if (status === "survey_review") return 2;
  if (status === "design_review") return 3;
  if (status === "cost_review") return 4;
  if (status === "audit" || status === "outputs" || status === "complete") {
    return 5;
  }
  return 0;
}

function stageFlagsFromStatus(status: ProjectStatus): boolean[] {
  const count = completedCountFor(status);
  return STAGES.map((_, index) => index < count);
}

type Props = {
  projectId: string;
  address: string;
  status: ProjectStatus;
  progress: PipelineProgress;
};

export function ProcessingScreen({ projectId, address, status, progress }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [pollCount, setPollCount] = useState(0);
  const stageFlags = useMemo(
    () =>
      progress
        ? [
            progress.hasTranscript,
            progress.hasSurvey,
            progress.hasDesign,
            progress.hasCosting,
            progress.hasAudit,
          ]
        : stageFlagsFromStatus(status),
    [progress, status],
  );
  const completeCount = stageFlags.filter(Boolean).length;
  const activeIndex = stageFlags.findIndex((flag) => !flag);
  const complete = progress ? progress.ready : completeCount >= STAGES.length;
  const failedAt = FAILED_STAGE_INDEX[status] ?? null;
  /* A failed pipeline never progresses on its own — stop polling and pin
   * the error on the failed rung instead of waiting out the 60s timeout. */
  const failed = failedAt != null;
  const failedStageLabel =
    failedAt != null && failedAt < STAGES.length
      ? STAGES[failedAt].label
      : "Outputs";
  const timedOut = !complete && !failed && pollCount >= 30;
  const stopped = timedOut || failed;

  const stageStates = useMemo(
    () =>
      STAGES.map((stage, index) => ({
        ...stage,
        complete: stageFlags[index],
        active: !stopped && index === (activeIndex >= 0 ? activeIndex : STAGES.length - 1),
        error:
          (timedOut && index === (activeIndex >= 0 ? activeIndex : STAGES.length - 1)) ||
          (failed && index === Math.min(failedAt ?? 0, STAGES.length - 1)),
      })),
    [activeIndex, stageFlags, stopped, timedOut, failed, failedAt],
  );

  useEffect(() => {
    if (complete) {
      router.replace(`/projects/${projectId}?mode=sketch`);
      return;
    }
    if (stopped) return;

    const timer = window.setInterval(() => {
      setPollCount((count) => count + 1);
      router.refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [complete, projectId, router, stopped]);

  const retry = () => {
    startTransition(async () => {
      try {
        await restartPipelineAction(projectId);
        setPollCount(0);
        toast.show("Pipeline restarted", "success");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not restart processing";
        toast.show(message, "error", 6000);
      }
    });
  };

  return (
    <main className={`${s.pageNarrow} ${styles.processingPage}`}>
      <section className={styles.processingHero}>
        <span className={s.kicker}>SITE PROCESSING</span>
        <h1 className={s.h1}>Preparing the drawing board</h1>
        <p className={styles.processingAddress}>{address}</p>
        <p className={styles.processingCopy}>
          Workstream is turning the site walkthrough into survey context,
          sketch guidance, quote data, and audit checks. This page refreshes
          automatically and will stop with a retry action if processing stalls.
        </p>
        {progress ? (
          <div className={styles.processingSignals} aria-label="Backend progress">
            <span className={`${styles.processingSignal} ${progress.hasTranscript ? styles.processingSignalDone : ""}`}>
              Transcript
            </span>
            <span className={`${styles.processingSignal} ${progress.hasSurvey ? styles.processingSignalDone : ""}`}>
              Survey
            </span>
            <span className={`${styles.processingSignal} ${progress.hasDesign ? styles.processingSignalDone : ""}`}>
              Design
            </span>
            <span className={`${styles.processingSignal} ${progress.hasCosting ? styles.processingSignalDone : ""}`}>
              Costing
            </span>
            <span className={`${styles.processingSignal} ${progress.hasAudit ? styles.processingSignalDone : ""}`}>
              Audit
            </span>
          </div>
        ) : null}
      </section>

      <section className={styles.processingStages} aria-label="Pipeline stages">
        {stageStates.map((stage) => (
          <article
            key={stage.key}
            className={`${styles.processingStage}${stage.complete ? ` ${styles.processingStageDone}` : ""}${stage.active ? ` ${styles.processingStageActive}` : ""}${stage.error ? ` ${styles.processingStageError}` : ""}`}
          >
            <span className={styles.processingStageIcon} aria-hidden>
              {stage.complete ? "✓" : stage.error ? "✕" : stage.active ? "" : "○"}
            </span>
            {stage.active ? (
              <span className={styles.processingSpinner} aria-hidden />
            ) : null}
            <div>
              <h2 className={styles.processingStageLabel}>{stage.label}</h2>
              <p className={styles.processingStageDescription}>
                {stage.description}
              </p>
            </div>
          </article>
        ))}
      </section>

      {stopped ? (
        <section className={styles.processingError} role="alert">
          <h2>
            {failed
              ? `${failedStageLabel} failed`
              : "Processing needs attention"}
          </h2>
          <p>
            {failed ? (
              <>
                The pipeline stopped at the {failedStageLabel.toLowerCase()} stage.
                Retry now; if it fails again, check the API worker logs before
                sending a client link.
              </>
            ) : (
              <>
                The pipeline did not report progress after one minute. Retry now;
                if it fails again, check the API worker logs before sending a
                client link.
              </>
            )}
          </p>
          <KitButton
            type="button"
            variant="accent"
            onClick={retry}
            disabled={isPending}
          >
            {isPending ? "Retrying…" : "Retry processing"}
          </KitButton>
        </section>
      ) : (
        <p className={styles.processingHint} aria-live="polite">
          {complete
            ? "Complete — opening the studio."
            : progress
              ? "Polling the backend progress state every 2 seconds."
              : "Polling every 2 seconds."}
        </p>
      )}
    </main>
  );
}

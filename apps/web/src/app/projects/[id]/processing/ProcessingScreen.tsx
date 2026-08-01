"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restartPipelineAction } from "../../../actions";
import { useToast } from "../../../../components/ToastHost";
import { Button } from "../../../../components/ui";
import type { ProjectStatus } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import styles from "../project.module.css";

type StageKey = "transcribe" | "survey" | "design" | "costing" | "audit";

type Stage = {
  key: StageKey;
  label: string;
  description: string;
};

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

function completedCountFor(status: ProjectStatus): number {
  if (status === "survey_review") return 2;
  if (status === "design_review") return 3;
  if (status === "cost_review") return 4;
  if (status === "audit" || status === "outputs" || status === "complete") {
    return 5;
  }
  return 0;
}

function activeIndexFor(status: ProjectStatus): number {
  const count = completedCountFor(status);
  if (count >= STAGES.length) return -1;
  if (status === "recording" || status === "processing") return Math.max(count, 0);
  return 0;
}

type Props = {
  projectId: string;
  address: string;
  status: ProjectStatus;
};

export function ProcessingScreen({ projectId, address, status }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [pollCount, setPollCount] = useState(0);
  const completeCount = completedCountFor(status);
  const activeIndex = activeIndexFor(status);
  const complete = completeCount >= STAGES.length;
  const timedOut = !complete && pollCount >= 30;

  const stageStates = useMemo(
    () =>
      STAGES.map((stage, index) => ({
        ...stage,
        complete: index < completeCount,
        active: !timedOut && index === activeIndex,
        error: timedOut && index === activeIndex,
      })),
    [activeIndex, completeCount, timedOut],
  );

  useEffect(() => {
    if (complete) {
      router.replace(`/projects/${projectId}?mode=sketch`);
      return;
    }
    if (timedOut) return;

    const timer = window.setInterval(() => {
      setPollCount((count) => count + 1);
      router.refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [complete, projectId, router, timedOut]);

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

      {timedOut ? (
        <section className={styles.processingError} role="alert">
          <h2>Processing needs attention</h2>
          <p>
            The pipeline did not report progress after one minute. Retry now; if
            it fails again, check the API worker logs before sending a client link.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={retry}
            disabled={isPending}
          >
            {isPending ? "Retrying…" : "Retry processing"}
          </Button>
        </section>
      ) : (
        <p className={styles.processingHint} aria-live="polite">
          {complete ? "Complete — opening the studio." : "Polling every 2 seconds."}
        </p>
      )}
    </main>
  );
}

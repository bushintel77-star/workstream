"use client";

import type { Task } from "../lib/api";
import { GARDEN_COPY, type SiteNextAction } from "@workstream/domain";
import s from "./outstanding-panel.module.css";

const STATUS_LABEL: Record<Task["status"], string> = {
  pending: "To do",
  in_progress: "On it",
  blocked: "Stuck",
  done: "Done",
  cancelled: "Dropped",
};

type Props = {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  workflow: Array<{ label: string; done: boolean }>;
  next: SiteNextAction;
};

export function OutstandingPanel({
  open,
  onClose,
  tasks,
  workflow,
  next,
}: Props) {
  if (!open) return null;

  const openTasks = tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "in_progress" ||
      t.status === "blocked",
  );

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true">
      <div className={s.sheet}>
        <header className={s.head}>
          <h2 className={s.title}>{GARDEN_COPY.tasks.sheetTitle}</h2>
          <button type="button" className={s.close} onClick={onClose}>
            Done
          </button>
        </header>
        <div className={s.body}>
          <p className={s.section}>{GARDEN_COPY.tasks.workflowTitle}</p>
          <p className={s.next}>
            <strong>{next.label}</strong>
            {next.sub ? <span> — {next.sub}</span> : null}
          </p>
          <ul className={s.steps}>
            {workflow.map((step) => (
              <li
                key={step.label}
                className={step.done ? s.stepDone : undefined}
              >
                {step.done ? "Done — " : "— "}
                {step.label}
              </li>
            ))}
          </ul>
          <p className={s.section}>Tasks on this job</p>
          {openTasks.length === 0 ? (
            <p className={s.empty}>{GARDEN_COPY.tasks.none}</p>
          ) : (
            <ul className={s.tasks}>
              {openTasks.map((t) => (
                <li key={t.id}>
                  <span className={s.taskTitle}>{t.title}</span>
                  <span className={s.taskMeta}>
                    {STATUS_LABEL[t.status]} · {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

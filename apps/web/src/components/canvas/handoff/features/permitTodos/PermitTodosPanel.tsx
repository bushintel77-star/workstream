"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  assessPlanningFromStudio,
  diffDesignTodos,
  parseDesignTodoTrigger,
  planningToDesignTodos,
  promptableDesignTodos,
  type DesignTodoDraft,
} from "@workstream/domain";
import type { StudioComplianceReport } from "@workstream/domain";
import type { Task } from "@workstream/contracts";
import {
  listProjectTasksAction,
  syncDesignTodosAction,
  updateTaskStatusAction,
} from "../../../../../app/actions";
import type { StudioItem } from "../../studioCatalog";
import { BY_TYPE } from "../../studioCatalog";
import css from "./permitTodos.module.css";

type Props = {
  projectId: string;
  address: string;
  outdoorM2: number;
  items: StudioItem[];
  compliance: StudioComplianceReport;
};

function toComplianceItems(items: StudioItem[]) {
  return items.map((it) => {
    const d = BY_TYPE[it.t];
    return {
      id: it.id,
      t: it.t,
      x: it.x,
      y: it.y,
      scale: it.scale,
      ghost: it.ghost,
      dbhM: it.dbhM,
      canopyM: d.canopyM,
      wPx: d.w,
      hPx: d.h,
      areaKind: d.area,
    };
  });
}

function detailFromSpec(spec: string | null): string {
  if (!spec) return "";
  const nl = spec.indexOf("\n");
  return nl >= 0 ? spec.slice(nl + 1).trim() : "";
}

/**
 * Council / design to-dos — always visible as a faded council zone,
 * not a modal “Got it” card. Expand the list when the operator asks.
 */
export function PermitTodosPanel({
  projectId,
  address,
  outdoorM2,
  items,
  compliance,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const syncSig = useRef("");

  const drafts = useMemo((): DesignTodoDraft[] => {
    const flags = assessPlanningFromStudio({
      address,
      outdoorM2,
      items: toComplianceItems(items),
    });
    return planningToDesignTodos(flags, compliance.alerts);
  }, [address, outdoorM2, items, compliance.alerts]);

  const openDesignTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.source === "design" &&
          t.status !== "done" &&
          t.status !== "cancelled",
      ),
    [tasks],
  );

  const ambientAdvice = useMemo(() => {
    const hot = promptableDesignTodos(drafts);
    const openTriggers = new Set(
      openDesignTasks
        .map((t) => parseDesignTodoTrigger(t.technical_specifications))
        .filter(Boolean),
    );
    return (
      hot.find((d) => !openTriggers.has(d.trigger_id)) ??
      hot[0] ??
      (openDesignTasks[0]
        ? {
            title: openDesignTasks[0].title,
            technical_specifications:
              openDesignTasks[0].technical_specifications,
          }
        : null)
    );
  }, [drafts, openDesignTasks]);

  useEffect(() => {
    let cancelled = false;
    void listProjectTasksAction(projectId).then((list) => {
      if (!cancelled) setTasks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (drafts.length === 0) return;
    const sig = drafts
      .map((d) => d.trigger_id)
      .sort()
      .join("|");
    if (sig === syncSig.current) return;
    const existing = tasks;
    const { toCreate, toCancelIds } = diffDesignTodos(existing, drafts);
    if (toCreate.length === 0 && toCancelIds.length === 0) {
      syncSig.current = sig;
      return;
    }
    const t = window.setTimeout(() => {
      startTransition(() => {
        void syncDesignTodosAction(
          projectId,
          drafts.map((d) => ({
            title: d.title,
            priority: d.priority,
            technical_specifications: d.technical_specifications ?? null,
            trigger_id: d.trigger_id,
          })),
        ).then((res) => {
          syncSig.current = sig;
          setTasks(res.tasks);
          // Stay collapsed — ambient strip already surfaces the advisory.
        });
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [drafts, projectId, tasks]);

  const setStatus = (taskId: string, status: "done" | "cancelled") => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("status", status);
    startTransition(() => {
      void updateTaskStatusAction(fd).then(() =>
        listProjectTasksAction(projectId).then(setTasks),
      );
    });
  };

  if (drafts.length === 0 && openDesignTasks.length === 0) return null;

  return (
    <div className={css.root} data-testid="permit-todos">
      {ambientAdvice ? (
        <aside
          className={css.ambient}
          data-testid="permit-prompt"
          aria-label="Council advice"
        >
          <p className={css.ambientKicker}>Council</p>
          <p className={css.ambientTitle}>{ambientAdvice.title}</p>
          <p className={css.ambientDetail}>
            {"technical_specifications" in ambientAdvice
              ? detailFromSpec(
                  ambientAdvice.technical_specifications ?? null,
                ) ||
                "Likely needs a permit or specialist check — listed in design to-dos."
              : "Likely needs a permit or specialist check — listed in design to-dos."}
          </p>
        </aside>
      ) : null}

      <section
        className={css.panel}
        data-testid="permit-todo-list"
        data-open={expanded ? "true" : "false"}
      >
        <div className={css.head}>
          <button
            type="button"
            className={css.kicker}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            Design to-dos {pending ? "…" : ""}
          </button>
          <span className={css.count}>{openDesignTasks.length}</span>
        </div>
        {expanded ? (
          openDesignTasks.length === 0 ? (
            <p className={css.empty}>No open design actions yet.</p>
          ) : (
            <ul className={css.list}>
              {openDesignTasks.map((t) => (
                <li key={t.id} className={css.item}>
                  <div>
                    <p className={css.title}>{t.title}</p>
                    <p className={css.detail}>
                      {detailFromSpec(t.technical_specifications)}
                    </p>
                  </div>
                  <span className={css.priority}>{t.priority}</span>
                  <div className={css.itemActions}>
                    <button
                      type="button"
                      className={css.mini}
                      onClick={() => setStatus(t.id, "done")}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      className={css.mini}
                      onClick={() => setStatus(t.id, "cancelled")}
                    >
                      Drop
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}

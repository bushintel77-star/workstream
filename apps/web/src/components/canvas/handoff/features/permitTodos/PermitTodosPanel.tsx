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

function dismissKey(projectId: string) {
  return `ws-permit-prompt:${projectId}`;
}

function readDismissed(projectId: string): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(dismissKey(projectId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(projectId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(dismissKey(projectId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * As you design: recognise likely council / TRP / stormwater needs, prompt,
 * and keep a living design-sourced to-do list. Execution of the list comes later.
 */
export function PermitTodosPanel({
  projectId,
  address,
  outdoorM2,
  items,
  compliance,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    readDismissed(projectId),
  );
  const [expanded, setExpanded] = useState(true);
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

  const promptDraft = useMemo(() => {
    const hot = promptableDesignTodos(drafts).filter(
      (d) => !dismissed.has(d.trigger_id),
    );
    // Prefer a draft not already mirrored as an open task the user has seen.
    const openTriggers = new Set(
      openDesignTasks
        .map((t) => parseDesignTodoTrigger(t.technical_specifications))
        .filter(Boolean),
    );
    return (
      hot.find((d) => !openTriggers.has(d.trigger_id)) ?? hot[0] ?? null
    );
  }, [drafts, dismissed, openDesignTasks]);

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
    const sig = drafts.map((d) => d.trigger_id).sort().join("|");
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
          if (res.created > 0) setExpanded(true);
        });
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [drafts, projectId, tasks]);

  const onDismissPrompt = () => {
    if (!promptDraft) return;
    const next = new Set(dismissed);
    next.add(promptDraft.trigger_id);
    setDismissed(next);
    writeDismissed(projectId, next);
  };

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
      {promptDraft ? (
        <aside className={css.prompt} data-testid="permit-prompt">
          <p className={css.promptKicker}>Council advice</p>
          <p className={css.promptTitle}>{promptDraft.title}</p>
          <p className={css.promptDetail}>
            {detailFromSpec(promptDraft.technical_specifications ?? null) ||
              "This design step likely needs a permit or specialist check. It is on your design to-do list."}
          </p>
          <div className={css.promptActions}>
            <button
              type="button"
              className={css.btn}
              onClick={() => {
                setExpanded(true);
                onDismissPrompt();
              }}
            >
              Got it
            </button>
            <button
              type="button"
              className={css.btnGhost}
              onClick={onDismissPrompt}
            >
              Dismiss
            </button>
          </div>
        </aside>
      ) : null}

      <section className={css.panel} data-testid="permit-todo-list">
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

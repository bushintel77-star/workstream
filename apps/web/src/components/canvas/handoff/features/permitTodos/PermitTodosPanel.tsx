"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  assessPlanningFromStudio,
  diffDesignTodos,
  planningToDesignTodos,
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
  /**
   * Sync design to-dos in the background with no canvas chrome.
   * List UI belongs in the compliance sidecar (`embedded`).
   */
  syncOnly?: boolean;
  /** Flow layout inside utility sheet — never a corner card. */
  embedded?: boolean;
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
 * Design to-dos — sync + list. Never a permanent bottom-left canvas card.
 * TPZ / council meaning stays on-plan (zone + hover).
 */
export function PermitTodosPanel({
  projectId,
  address,
  outdoorM2,
  items,
  compliance,
  syncOnly = false,
  embedded = false,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(embedded);
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

  if (syncOnly) return null;

  if (drafts.length === 0 && openDesignTasks.length === 0) return null;

  return (
    <div
      className={embedded ? css.embedded : css.root}
      data-testid="permit-todos"
      data-embedded={embedded ? "true" : "false"}
    >
      <section
        className={embedded ? css.embeddedPanel : css.panel}
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
